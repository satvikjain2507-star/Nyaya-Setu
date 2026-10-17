/**
 * Shared voice recorder (Expo SDK 55+). expo-av was removed in SDK 55, so all
 * voice features now record through expo-audio.
 *
 * Records small mono AAC (.m4a) files — compact enough to upload quickly to
 * Gemini on mobile data, in a format Gemini accepts as "audio/m4a".
 */
import { useAudioRecorder, RecordingPresets, AudioModule, setAudioModeAsync } from "expo-audio";
import { File } from "expo-file-system";

const VOICE_PRESET = {
  ...RecordingPresets.HIGH_QUALITY, // AAC in an .m4a container on Android and iOS
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 32000,
};

export function useVoiceRecorder() {
  const recorder = useAudioRecorder(VOICE_PRESET);

  /** Ask for the mic and start recording. Returns false if permission is denied. */
  const start = async () => {
    const perm = await AudioModule.requestRecordingPermissionsAsync();
    if (!perm.granted) return false;
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    return true;
  };

  /** Stop recording and return the audio as base64 (or null if nothing was recorded). */
  const stop = async () => {
    await recorder.stop();
    // switch the audio session back to playback so spoken answers use the loudspeaker
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
    const uri = recorder.uri;
    if (!uri) return null;
    return new File(uri).base64();
  };

  return { start, stop };
}
