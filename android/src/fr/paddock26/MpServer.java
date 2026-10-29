package fr.paddock26;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Petit serveur WebSocket (texte uniquement) pour le multijoueur en Wi-Fi :
 * le téléphone hôte l'ouvre, les autres téléphones s'y connectent depuis leur WebView.
 */
class MpServer {
    interface Listener {
        void onOpen(int id);
        void onMessage(int id, String text);
        void onClose(int id);
    }

    private final Listener listener;
    private ServerSocket server;
    private final Map<Integer, Client> clients = new ConcurrentHashMap<>();
    private int nextId = 1;
    private volatile boolean running;

    MpServer(Listener l) { listener = l; }

    int start(int port) throws Exception {
        server = new ServerSocket();
        server.setReuseAddress(true);   // le port reste libre même juste après une partie précédente
        server.bind(new java.net.InetSocketAddress(port));
        running = true;
        Thread t = new Thread(() -> {
            while (running) {
                try {
                    Socket s = server.accept();
                    s.setTcpNoDelay(true);
                    Client c = new Client(nextId++, s);
                    new Thread(c::run, "mp-client-" + c.id).start();
                } catch (Exception e) {
                    if (!running) break;
                }
            }
        }, "mp-accept");
        t.setDaemon(true);
        t.start();
        return server.getLocalPort();
    }

    void stop() {
        running = false;
        try { if (server != null) server.close(); } catch (Exception ignored) { }
        for (Client c : clients.values()) c.close();
        clients.clear();
    }

    void send(int id, String text) { Client c = clients.get(id); if (c != null) c.send(text); }

    void broadcast(String text) { for (Client c : clients.values()) c.send(text); }

    void kick(int id) { Client c = clients.get(id); if (c != null) c.close(); }

    private class Client {
        final int id;
        final Socket sock;
        OutputStream out;

        Client(int id, Socket s) { this.id = id; sock = s; }

        void run() {
            try {
                InputStream in = sock.getInputStream();
                out = sock.getOutputStream();
                if (!handshake(in)) { sock.close(); return; }
                clients.put(id, this);
                listener.onOpen(id);
                ByteArrayOutputStream msg = new ByteArrayOutputStream();
                while (running) {
                    int b0 = in.read(); if (b0 < 0) break;
                    int b1 = in.read(); if (b1 < 0) break;
                    boolean fin = (b0 & 0x80) != 0;
                    int op = b0 & 0x0F;
                    boolean masked = (b1 & 0x80) != 0;
                    long len = b1 & 0x7F;
                    if (len == 126) len = (in.read() << 8) | in.read();
                    else if (len == 127) { len = 0; for (int i = 0; i < 8; i++) len = (len << 8) | in.read(); }
                    byte[] mask = new byte[4];
                    if (masked) readFully(in, mask);
                    byte[] data = new byte[(int) len];
                    readFully(in, data);
                    if (masked) for (int i = 0; i < data.length; i++) data[i] ^= mask[i & 3];
                    if (op == 8) break;                                   // fermeture
                    if (op == 9) { frame(10, data); continue; }           // ping -> pong
                    if (op == 10) continue;
                    msg.write(data);
                    if (fin) { listener.onMessage(id, new String(msg.toByteArray(), StandardCharsets.UTF_8)); msg.reset(); }
                }
            } catch (Exception ignored) {
            } finally {
                close();
            }
        }

        private boolean handshake(InputStream in) throws Exception {
            StringBuilder sb = new StringBuilder();
            int c, n = 0;
            while ((c = in.read()) >= 0) {
                sb.append((char) c);
                if (sb.length() >= 4 && sb.substring(sb.length() - 4).equals("\r\n\r\n")) break;
                if (++n > 16384) return false;
            }
            String key = null;
            for (String line : sb.toString().split("\r\n")) {
                int k = line.indexOf(':');
                if (k > 0 && line.substring(0, k).trim().equalsIgnoreCase("Sec-WebSocket-Key")) key = line.substring(k + 1).trim();
            }
            if (key == null) return false;
            MessageDigest sha = MessageDigest.getInstance("SHA-1");
            String acc = android.util.Base64.encodeToString(sha.digest((key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").getBytes(StandardCharsets.UTF_8)), android.util.Base64.NO_WRAP);
            String resp = "HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: " + acc + "\r\n\r\n";
            out.write(resp.getBytes(StandardCharsets.UTF_8));
            out.flush();
            return true;
        }

        private void readFully(InputStream in, byte[] b) throws Exception {
            int o = 0;
            while (o < b.length) { int r = in.read(b, o, b.length - o); if (r < 0) throw new Exception("eof"); o += r; }
        }

        synchronized void frame(int op, byte[] data) {
            try {
                ByteArrayOutputStream f = new ByteArrayOutputStream();
                f.write(0x80 | op);
                int len = data.length;
                if (len < 126) f.write(len);
                else if (len < 65536) { f.write(126); f.write(len >> 8); f.write(len & 0xFF); }
                else { f.write(127); for (int i = 7; i >= 0; i--) f.write((int) (((long) len >> (8 * i)) & 0xFF)); }
                f.write(data);
                out.write(f.toByteArray());
                out.flush();
            } catch (Exception e) { close(); }
        }

        void send(String text) { if (out != null) frame(1, text.getBytes(StandardCharsets.UTF_8)); }

        void close() {
            boolean was = clients.remove(id) != null;
            try { sock.close(); } catch (Exception ignored) { }
            if (was) listener.onClose(id);
        }
    }
}
