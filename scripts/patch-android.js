// Run after `npx cap add android`: adds the permissions the app needs to AndroidManifest.xml.
const fs=require('fs');
const p='android/app/src/main/AndroidManifest.xml';
let x=fs.readFileSync(p,'utf8');
let add='';
const perm=(n,extra='')=>{if(!x.includes(`"${n}"`))add+=`    <uses-permission android:name="${n}"${extra} />\n`};
perm('android.permission.INTERNET');
perm('android.permission.CAMERA');
perm('android.permission.RECORD_AUDIO');
perm('android.permission.READ_MEDIA_IMAGES');
perm('android.permission.READ_EXTERNAL_STORAGE',' android:maxSdkVersion="32"');
perm('android.permission.WRITE_EXTERNAL_STORAGE',' android:maxSdkVersion="28"');
if(!x.includes('android.hardware.camera'))add+='    <uses-feature android:name="android.hardware.camera" android:required="false" />\n';
if(!x.includes('android.speech.RecognitionService'))add+='    <queries>\n        <intent>\n            <action android:name="android.speech.RecognitionService" />\n        </intent>\n    </queries>\n';
x=x.replace('</manifest>',add+'</manifest>');
fs.writeFileSync(p,x);
console.log('AndroidManifest.xml patched');
