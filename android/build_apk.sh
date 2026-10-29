#!/bin/zsh
# Construit l'APK Android « Paddock 26 » (coquille WebView) sans Gradle, puis l'installe si un appareil est connecté.
#   ./build_apk.sh        version complète (fr.paddock26), clé locale
#   ./build_apk.sh essai  appli d'essai du Play Store (fr.paddock26.essai) : APK + AAB signés avec la clé d'envoi
set -e
cd "${0:A:h}"
SDK="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
BT="$SDK/build-tools/$(ls $SDK/build-tools | sort -V | tail -1)"
JAR="$SDK/platforms/$(ls $SDK/platforms | sort -V | tail -1)/android.jar"
if [[ "$1" == essai ]]; then
  V=essai PKG=fr.paddock26.essai HTML=paddock26-essai.html NAME=paddock26-essai
  KS=paddock26-essai-upload.jks ALIAS=upload
  # mot de passe de la clé d'envoi Play Store : créé une fois, à sauvegarder avec le .jks
  [ -f essai-upload-key.txt ] || LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c 24 > essai-upload-key.txt
  PASS=$(cat essai-upload-key.txt)
else
  V= PKG=fr.paddock26 HTML=paddock26.html NAME=paddock26
  # mot de passe du keystore local : variable PADDOCK26_KS_PASS ou fichier non versionné
  KS=paddock26.keystore ALIAS=paddock26 PASS="${PADDOCK26_KS_PASS:-$(cat paddock26-keystore-pass.txt)}"
fi
OUT=build$V ASSETS=assets$V
rm -rf $OUT && mkdir -p $OUT/classes $ASSETS

# 1. page de l'app, avec three.js intégré pour fonctionner hors ligne
python3 ../build.py $V >/dev/null
python3 - ../dist/$HTML $ASSETS/index.html <<'EOF'
import sys
html = open(sys.argv[1], encoding='utf-8').read()
three = open('three.min.js', encoding='utf-8').read()
tag = '<script src="https://cdn.jsdelivr.net/npm/three@0.147.0/build/three.min.js"></script>'
assert tag in html
html = html.replace(tag, '<script>' + three + '</script>')
open(sys.argv[2], 'w', encoding='utf-8').write(html)
EOF

# 2. manifeste (l'essai : autre identifiant, son propre nom et ses propres versions, sans multijoueur Wi-Fi)
MAN=AndroidManifest.xml
if [[ -n "$V" ]]; then
  MAN=$OUT/AndroidManifest.xml
  sed -e 's/android:versionCode="[0-9]*"/android:versionCode="1"/' -e 's/android:versionName="[^"]*"/android:versionName="1.0"/' \
      -e 's/android:label="Paddock 26"/android:label="Paddock 26 Essai"/' -e '/CHANGE_WIFI_MULTICAST_STATE\|ACCESS_WIFI_STATE/d' \
      AndroidManifest.xml > $MAN
fi

# 3. ressources : format binaire pour l'APK, format protobuf pour l'AAB
"$BT/aapt2" compile --dir res -o $OUT/res.zip
LINK=(-I "$JAR" --manifest $MAN -A $ASSETS $OUT/res.zip --auto-add-overlay --rename-manifest-package $PKG)
"$BT/aapt2" link $LINK -o $OUT/base.apk
[[ -n "$V" ]] && "$BT/aapt2" link $LINK --proto-format -o $OUT/proto.apk

# 4. code Java -> dex
javac -source 11 -target 11 -classpath "$JAR" -d $OUT/classes $(find src -name "*.java") 2>&1 | grep -v "warning" || true
"$BT/d8" --lib "$JAR" --min-api 24 --output $OUT $(find $OUT/classes -name '*.class')
(cd $OUT && zip -q -j base.apk classes.dex)

# 5. alignement + signature
[ -f $KS ] || keytool -genkeypair -keystore $KS -storepass $PASS -keypass $PASS \
  -alias $ALIAS -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Paddock 26" >/dev/null 2>&1
"$BT/zipalign" -f 4 $OUT/base.apk $OUT/aligned.apk
"$BT/apksigner" sign --ks $KS --ks-pass pass:$PASS --out $NAME.apk $OUT/aligned.apk
echo "APK : $(pwd)/$NAME.apk"

# 6. AAB pour le Play Store (essai seulement)
if [[ -n "$V" ]]; then
  M=$OUT/module && mkdir -p $M/manifest $M/dex
  (cd $M && unzip -q ../proto.apk && mv AndroidManifest.xml manifest/ && cp ../classes.dex dex/ && zip -q -r ../base.zip .)
  java -jar bundletool.jar build-bundle --modules=$OUT/base.zip --output=$OUT/unsigned.aab --overwrite
  jarsigner -keystore $KS -storepass $PASS -sigalg SHA256withRSA -digestalg SHA-256 \
    -signedjar $NAME.aab $OUT/unsigned.aab $ALIAS >/dev/null
  echo "AAB : $(pwd)/$NAME.aab"
fi

# 7. installation sur le téléphone (débogage USB ou sans fil)
if adb get-state >/dev/null 2>&1; then
  adb install -r $NAME.apk
  adb shell monkey -p $PKG -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
  echo "Installé et lancé sur le téléphone."
fi
