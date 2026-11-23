package com.creatorstudio.v2;

import android.media.AudioAttributes;
import android.os.Bundle;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/* The app's voice on the phone (js/voice.js): Android's own text-to-speech.
 * Offline, free, no key — it uses whatever engine the phone has (Google's on
 * most). An Android WebView usually has no speechSynthesis, which is why this
 * exists.
 *
 *   speak({ text, rate })   stops anything already playing, then reads text.
 *                           Resolves once it has started; "speakDone" fires
 *                           when the last sentence has been said.
 *   stop()                  silence, now.
 *   available()             { ready } — whether the engine has started.
 *
 * Android 11+ only lets an app find the engine if the manifest asks for it:
 *   <queries><intent><action android:name="android.intent.action.TTS_SERVICE"/></intent></queries>
 */
@CapacitorPlugin(name = "CSSpeak")
public class CSSpeakPlugin extends Plugin {

    private TextToSpeech tts;
    private boolean ready = false;
    private PluginCall waiting;           /* a speak() that came before the engine was up */
    private String lastId = "";

    @Override
    public void load() {
        start();
    }

    private void start() {
        if (tts != null) return;
        tts = new TextToSpeech(getContext(), status -> {
            ready = status == TextToSpeech.SUCCESS;
            if (ready) {
                int r = tts.setLanguage(Locale.getDefault());
                if (r == TextToSpeech.LANG_MISSING_DATA || r == TextToSpeech.LANG_NOT_SUPPORTED) tts.setLanguage(Locale.US);
                tts.setAudioAttributes(new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ASSISTANT)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .build());
                tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                    @Override public void onStart(String id) {}
                    @Override public void onDone(String id) {
                        if (id.equals(lastId)) notifyListeners("speakDone", new JSObject());
                    }
                    @Override public void onError(String id) {
                        notifyListeners("speakError", new JSObject());
                    }
                    @Override public void onStop(String id, boolean interrupted) {
                        if (id.equals(lastId)) notifyListeners("speakDone", new JSObject());
                    }
                });
            }
            PluginCall c = waiting;
            waiting = null;
            if (c != null) {
                if (ready) say(c);
                else c.reject("Text-to-speech isn't available on this phone");
            }
        });
    }

    @PluginMethod
    public void speak(PluginCall call) {
        String text = call.getString("text", "");
        if (text == null || text.trim().isEmpty()) { call.reject("Nothing to say"); return; }
        if (tts == null) start();
        if (!ready) {
            if (waiting != null) waiting.reject("Replaced");
            waiting = call;
            return;
        }
        say(call);
    }

    private void say(PluginCall call) {
        String text = call.getString("text", "");
        Double rate = call.getDouble("rate", 1.0);
        tts.stop();
        tts.setSpeechRate(rate == null ? 1.0f : rate.floatValue());
        tts.setPitch(1.0f);

        /* the engine has a length limit; go a sentence or two at a time */
        List<String> parts = split(text, Math.max(200, TextToSpeech.getMaxSpeechInputLength() - 50));
        String base = "cs_" + System.currentTimeMillis() + "_";
        lastId = base + (parts.size() - 1);
        for (int i = 0; i < parts.size(); i++) {
            Bundle b = new Bundle();
            tts.speak(parts.get(i), i == 0 ? TextToSpeech.QUEUE_FLUSH : TextToSpeech.QUEUE_ADD, b, base + i);
        }
        call.resolve();
    }

    private static List<String> split(String text, int max) {
        List<String> out = new ArrayList<>();
        StringBuilder cur = new StringBuilder();
        for (String s : text.split("(?<=[.!?])\\s+")) {
            if (cur.length() + s.length() + 1 > max && cur.length() > 0) { out.add(cur.toString()); cur.setLength(0); }
            if (s.length() > max) {
                for (int i = 0; i < s.length(); i += max) out.add(s.substring(i, Math.min(s.length(), i + max)));
                continue;
            }
            if (cur.length() > 0) cur.append(' ');
            cur.append(s);
        }
        if (cur.length() > 0) out.add(cur.toString());
        if (out.isEmpty()) out.add(text);
        return out;
    }

    @PluginMethod
    public void stop(PluginCall call) {
        if (tts != null) tts.stop();
        call.resolve();
    }

    @PluginMethod
    public void available(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("ready", ready);
        call.resolve(ret);
    }

    @Override
    protected void handleOnDestroy() {
        if (tts != null) { tts.stop(); tts.shutdown(); tts = null; ready = false; }
    }
}
