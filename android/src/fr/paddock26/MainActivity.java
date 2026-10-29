package fr.paddock26;

import android.app.Activity;
import android.content.ContentValues;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.content.Context;
import android.net.nsd.NsdManager;
import android.net.nsd.NsdServiceInfo;
import android.net.wifi.WifiManager;
import org.json.JSONObject;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.NetworkInterface;
import java.util.Collections;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import android.os.Bundle;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.speech.tts.Voice;
import org.json.JSONArray;
import java.io.FileInputStream;
import java.util.Locale;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/** Coquille WebView plein écran qui charge l'application embarquée (assets/index.html). */
public class MainActivity extends Activity {
    private WebView web;
    private android.webkit.ValueCallback<Uri[]> fileCb;
    private static final int PICK_FILE = 7;

    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        super.onActivityResult(req, res, data);
        if (req != PICK_FILE || fileCb == null) return;
        Uri u = res == RESULT_OK && data != null ? data.getData() : null;
        fileCb.onReceiveValue(u != null ? new Uri[] { u } : null);
        fileCb = null;
    }

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        WebView.setWebContentsDebuggingEnabled(!getPackageName().endsWith(".essai"));   // inspection depuis l'ordinateur (chrome://inspect), sauf dans l'appli d'essai du Play Store
        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#0c0e12"));
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(true);
        s.setTextZoom(100);
        web.setWebViewClient(new WebViewClient());
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView v, android.webkit.ValueCallback<Uri[]> cb, FileChooserParams p) {
                if (fileCb != null) fileCb.onReceiveValue(null);
                fileCb = cb;
                Intent i = new Intent(Intent.ACTION_GET_CONTENT); i.addCategory(Intent.CATEGORY_OPENABLE); i.setType("*/*");
                try { startActivityForResult(Intent.createChooser(i, "Replay"), PICK_FILE); } catch (Exception e) { fileCb = null; return false; }
                return true;
            }
        });
        web.addJavascriptInterface(new Native(), "PaddockNative");
        web.addJavascriptInterface(new Multi(), "PaddockMP");
        web.addJavascriptInterface(new Speech(), "PaddockTTS");
        initTts();
        setContentView(web);
        immersive();
        if (state != null) web.restoreState(state);
        else web.loadUrl("file:///android_asset/index.html");
    }

    /** Pont JavaScript : enregistre la vidéo des highlights (envoyée par morceaux en base64) et la partage. */
    private class Native {
        private OutputStream out; private Uri uri; private String mime = "video/mp4"; private String where = "";
        @JavascriptInterface public void saveBegin(String name, String type) throws Exception {
            mime = type == null || type.isEmpty() ? "video/mp4" : type;
            boolean video = mime.startsWith("video/");   // vidéos → Films/Paddock26, autres fichiers (replays) → Téléchargements/Paddock26
            if (Build.VERSION.SDK_INT >= 29) {
                ContentValues v = new ContentValues();
                v.put(MediaStore.MediaColumns.DISPLAY_NAME, name);
                v.put(MediaStore.MediaColumns.MIME_TYPE, mime);
                v.put(MediaStore.MediaColumns.RELATIVE_PATH, (video ? Environment.DIRECTORY_MOVIES : Environment.DIRECTORY_DOWNLOADS) + "/Paddock26");
                v.put(MediaStore.MediaColumns.IS_PENDING, 1);
                uri = getContentResolver().insert(video ? MediaStore.Video.Media.EXTERNAL_CONTENT_URI : MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
                out = getContentResolver().openOutputStream(uri);
                where = (video ? "Films/Paddock26/" : "Téléchargements/Paddock26/") + name;
            } else {
                File dir = getExternalFilesDir(video ? Environment.DIRECTORY_MOVIES : Environment.DIRECTORY_DOWNLOADS);
                File f = new File(dir, name); out = new FileOutputStream(f); uri = Uri.fromFile(f); where = f.getAbsolutePath();
            }
        }
        @JavascriptInterface public void saveChunk(String b64) throws Exception { if (out != null) out.write(Base64.decode(b64, Base64.DEFAULT)); }
        @JavascriptInterface public String saveEnd() throws Exception {
            if (out != null) { out.close(); out = null; }
            if (Build.VERSION.SDK_INT >= 29 && uri != null) { ContentValues v = new ContentValues(); v.put(MediaStore.MediaColumns.IS_PENDING, 0); getContentResolver().update(uri, v, null, null); }
            return where;
        }
        /** identifiant stable de l'appareil pour cette appli (sert au code de la version complète) */
        @JavascriptInterface public String deviceId() {
            String id = android.provider.Settings.Secure.getString(getContentResolver(), android.provider.Settings.Secure.ANDROID_ID);
            return id == null ? "" : id;
        }
        @JavascriptInterface public void share() {
            if (uri == null) return;
            Intent i = new Intent(Intent.ACTION_SEND); i.setType(mime); i.putExtra(Intent.EXTRA_STREAM, uri); i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            runOnUiThread(() -> startActivity(Intent.createChooser(i, "Partager les highlights")));
        }
    }


    /* ---------- voix de synthèse (commentaire des vidéos) : chaque phrase est rendue en fichier WAV puis renvoyée en base64,
       pour être jouée et enregistrée dans la vidéo exportée ---------- */
    private TextToSpeech tts; private volatile int ttsState = 0;   // 0 = en cours, 1 = prêt, -1 = indisponible
    private void initTts() {
        tts = new TextToSpeech(this, st -> {
            ttsState = st == TextToSpeech.SUCCESS ? 1 : -1;
            if (ttsState == 1) tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                @Override public void onStart(String id) { }
                @Override public void onDone(String id) { ttsBack(id, true); }
                @Override public void onError(String id) { ttsBack(id, false); }
                @Override public void onError(String id, int code) { ttsBack(id, false); }
            });
        });
    }
    private File ttsFile(String id) { return new File(getCacheDir(), "tts_" + id.replaceAll("[^A-Za-z0-9_-]", "") + ".wav"); }
    private void ttsBack(String id, boolean ok) {
        String b64 = "";
        File f = ttsFile(id);
        if (ok) try (FileInputStream in = new FileInputStream(f)) {
            byte[] b = new byte[(int) f.length()]; int n = 0; while (n < b.length) { int r = in.read(b, n, b.length - n); if (r < 0) break; n += r; }
            b64 = Base64.encodeToString(b, 0, n, Base64.NO_WRAP);
        } catch (Exception ignored) { }
        f.delete();
        js("window.__tts&&__tts.done(" + JSONObject.quote(id) + "," + JSONObject.quote(b64) + ")");
    }
    private class Speech {
        @JavascriptInterface public int state() { return ttsState; }
        /** voix installées pour une langue ("fr" / "en") : [{name, loc, q, net}] */
        @JavascriptInterface public String voices(String lang) {
            JSONArray a = new JSONArray();
            try {
                for (Voice v : tts.getVoices()) {
                    Locale l = v.getLocale(); if (l == null || !l.getLanguage().equals(lang)) continue;
                    if (v.getFeatures() != null && v.getFeatures().contains(TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED)) continue;
                    JSONObject o = new JSONObject();
                    o.put("name", v.getName()); o.put("loc", l.toLanguageTag()); o.put("q", v.getQuality()); o.put("net", v.isNetworkConnectionRequired());
                    a.put(o);
                }
            } catch (Exception ignored) { }
            return a.toString();
        }
        /** rend une phrase dans un fichier ; la réponse arrive par window.__tts.done(id, base64) */
        @JavascriptInterface public boolean synth(String id, String text, String lang, String voice, float rate, float pitch) {
            if (ttsState != 1) return false;
            try {
                Voice chosen = null;
                if (voice != null && !voice.isEmpty()) for (Voice v : tts.getVoices()) if (v.getName().equals(voice)) { chosen = v; break; }
                if (chosen != null) tts.setVoice(chosen);
                else tts.setLanguage("en".equals(lang) ? Locale.UK : Locale.FRANCE);
                tts.setSpeechRate(rate); tts.setPitch(pitch);
                Bundle p = new Bundle(); p.putString(TextToSpeech.Engine.KEY_PARAM_UTTERANCE_ID, id);
                return tts.synthesizeToFile(text, p, ttsFile(id), id) == TextToSpeech.SUCCESS;
            } catch (Exception e) { return false; }
        }
    }

    /* ---------- multijoueur en Wi-Fi : serveur WebSocket sur l'hôte + découverte des parties (NSD) ---------- */
    private MpServer mp;
    private NsdManager.RegistrationListener nsdReg;
    private NsdManager.DiscoveryListener nsdDisc;
    private WifiManager.MulticastLock mlock;

    private void js(String code) { runOnUiThread(() -> web.evaluateJavascript(code, null)); }

    private static String localIp() {
        try {
            for (NetworkInterface ni : Collections.list(NetworkInterface.getNetworkInterfaces())) {
                if (!ni.isUp() || ni.isLoopback()) continue;
                for (InetAddress a : Collections.list(ni.getInetAddresses()))
                    if (a instanceof Inet4Address && a.isSiteLocalAddress()) return a.getHostAddress();
            }
        } catch (Exception ignored) { }
        return "";
    }

    private class Multi {
        @JavascriptInterface public String myIp() { return localIp(); }

        @JavascriptInterface public String host(String name) {
            try {
                if (mp != null) mp.stop();
                mp = new MpServer(new MpServer.Listener() {
                    public void onOpen(int id) { js("window.__mp&&__mp.onOpen(" + id + ")"); }
                    public void onMessage(int id, String t) { js("window.__mp&&__mp.onMessage(" + id + "," + JSONObject.quote(t) + ")"); }
                    public void onClose(int id) { js("window.__mp&&__mp.onClose(" + id + ")"); }
                });
                int port;
                try { port = mp.start(47626); } catch (Exception e) { port = mp.start(0); }
                NsdServiceInfo si = new NsdServiceInfo();
                si.setServiceName("Paddock26 " + name); si.setServiceType("_paddock26._tcp"); si.setPort(port);
                NsdManager nm = (NsdManager) getSystemService(Context.NSD_SERVICE);
                nsdReg = new NsdManager.RegistrationListener() {
                    public void onServiceRegistered(NsdServiceInfo i) { }
                    public void onRegistrationFailed(NsdServiceInfo i, int e) { }
                    public void onServiceUnregistered(NsdServiceInfo i) { }
                    public void onUnregistrationFailed(NsdServiceInfo i, int e) { }
                };
                nm.registerService(si, NsdManager.PROTOCOL_DNS_SD, nsdReg);
                return localIp() + ":" + port;
            } catch (Exception e) { return ""; }
        }

        @JavascriptInterface public void stopHost() {
            if (mp != null) { mp.stop(); mp = null; }
            try { if (nsdReg != null) ((NsdManager) getSystemService(Context.NSD_SERVICE)).unregisterService(nsdReg); } catch (Exception ignored) { }
            nsdReg = null;
        }

        @JavascriptInterface public void send(int id, String t) { if (mp != null) mp.send(id, t); }
        @JavascriptInterface public void broadcast(String t) { if (mp != null) mp.broadcast(t); }
        @JavascriptInterface public void kick(int id) { if (mp != null) mp.kick(id); }

        @JavascriptInterface public void discover() {
            stopDiscover();
            try {
                WifiManager wm = (WifiManager) getApplicationContext().getSystemService(Context.WIFI_SERVICE);
                mlock = wm.createMulticastLock("paddock26"); mlock.setReferenceCounted(false); mlock.acquire();
            } catch (Exception ignored) { }
            NsdManager nm = (NsdManager) getSystemService(Context.NSD_SERVICE);
            nsdDisc = new NsdManager.DiscoveryListener() {
                public void onDiscoveryStarted(String t) { }
                public void onDiscoveryStopped(String t) { }
                public void onStartDiscoveryFailed(String t, int e) { }
                public void onStopDiscoveryFailed(String t, int e) { }
                public void onServiceLost(NsdServiceInfo i) { js("window.__mp&&__mp.onLost(" + JSONObject.quote(i.getServiceName()) + ")"); }
                public void onServiceFound(NsdServiceInfo i) {
                    nm.resolveService(i, new NsdManager.ResolveListener() {
                        public void onResolveFailed(NsdServiceInfo x, int e) { }
                        public void onServiceResolved(NsdServiceInfo x) {
                            String h = x.getHost() == null ? "" : x.getHost().getHostAddress();
                            js("window.__mp&&__mp.onFound(" + JSONObject.quote(x.getServiceName()) + "," + JSONObject.quote(h) + "," + x.getPort() + ")");
                        }
                    });
                }
            };
            try { nm.discoverServices("_paddock26._tcp", NsdManager.PROTOCOL_DNS_SD, nsdDisc); } catch (Exception ignored) { }
        }

        @JavascriptInterface public void stopDiscover() {
            try { if (nsdDisc != null) ((NsdManager) getSystemService(Context.NSD_SERVICE)).stopServiceDiscovery(nsdDisc); } catch (Exception ignored) { }
            nsdDisc = null;
            try { if (mlock != null) mlock.release(); } catch (Exception ignored) { }
        }
    }

    private void immersive() {
        web.setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
            | View.SYSTEM_UI_FLAG_FULLSCREEN
            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            | View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) immersive();
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    protected void onPause() { super.onPause(); web.onPause(); }

    @Override
    protected void onDestroy() { if (tts != null) tts.shutdown(); super.onDestroy(); }

    @Override
    protected void onResume() { super.onResume(); web.onResume(); }

    @Override
    public void onBackPressed() {
        // le bouton retour de l'app gère la navigation (menu / course) ; sinon on quitte
        web.evaluateJavascript("(function(){var q=document.getElementById('btn-quit');"
            + "if(q&&!document.getElementById('race').hidden){q.click();return 1;}"
            + "if(window.__navBack&&window.__navBack())return 1;return 0;})()",
            v -> { if (!"1".equals(v)) finish(); });
    }
}
