import { useState, useRef, useCallback, useEffect } from 'react';
import { Audio } from 'expo-av';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

/**
 * Voice Recording Hook
 * 
 * Handles audio recording with:
 * - Permission management with graceful fallback
 * - Max 60 second recording limit
 * - Duration tracking
 * - Base64 conversion for API
 */

interface VoiceRecordingState {
    isRecording: boolean;
    isPreparing: boolean;
    duration: number; // seconds
    hasPermission: boolean | null; // null = not checked yet
    permissionDenied: boolean;
    error: string | null;
}

interface VoiceRecordingResult {
    state: VoiceRecordingState;
    startRecording: () => Promise<void>;
    stopRecording: () => Promise<{ audioBase64: string; duration: number } | null>;
    cancelRecording: () => Promise<void>;
    requestPermission: () => Promise<boolean>;
}

const MAX_DURATION_SECONDS = 60;
const RECORDING_CONFIG: Audio.RecordingOptions = {
    android: {
        extension: '.m4a',
        outputFormat: Audio.AndroidOutputFormat.MPEG_4,
        audioEncoder: Audio.AndroidAudioEncoder.AAC,
        sampleRate: 44100,
        numberOfChannels: 1,
        bitRate: 128000,
    },
    ios: {
        extension: '.m4a',
        audioQuality: Audio.IOSAudioQuality.MEDIUM,
        sampleRate: 44100,
        numberOfChannels: 1,
        bitRate: 128000,
        linearPCMBitDepth: 16,
        linearPCMIsBigEndian: false,
        linearPCMIsFloat: false,
    },
    web: {
        mimeType: 'audio/webm',
        bitsPerSecond: 128000,
    },
};

export function useVoiceRecording(): VoiceRecordingResult {
    const [state, setState] = useState<VoiceRecordingState>({
        isRecording: false,
        isPreparing: false,
        duration: 0,
        hasPermission: null,
        permissionDenied: false,
        error: null,
    });

    const recordingRef = useRef<Audio.Recording | null>(null);
    const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const startTimeRef = useRef<number>(0);

    // Clean up on unmount
    useEffect(() => {
        return () => {
            if (recordingRef.current) {
                recordingRef.current.stopAndUnloadAsync().catch(() => { });
            }
            if (durationIntervalRef.current) {
                clearInterval(durationIntervalRef.current);
            }
        };
    }, []);

    // Request microphone permission
    const requestPermission = useCallback(async (): Promise<boolean> => {
        try {
            const { status } = await Audio.requestPermissionsAsync();
            const granted = status === 'granted';

            setState(prev => ({
                ...prev,
                hasPermission: granted,
                permissionDenied: !granted,
                error: !granted ? 'Microphone permission denied. You can still type your task.' : null,
            }));

            return granted;
        } catch (error) {
            // Audio permission request failed
            setState(prev => ({
                ...prev,
                hasPermission: false,
                permissionDenied: true,
                error: 'Failed to request microphone permission',
            }));
            return false;
        }
    }, []);

    // Start recording
    const startRecording = useCallback(async () => {
        try {
            setState(prev => ({ ...prev, isPreparing: true, error: null }));

            // Check/request permission
            let hasPermission = state.hasPermission;
            if (hasPermission !== true) {
                hasPermission = await requestPermission();
                if (!hasPermission) {
                    setState(prev => ({ ...prev, isPreparing: false }));
                    return;
                }
            }

            // Set audio mode
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
            });

            // Create and start recording
            const { recording } = await Audio.Recording.createAsync(RECORDING_CONFIG);
            recordingRef.current = recording;
            startTimeRef.current = Date.now();

            // Start duration tracking
            durationIntervalRef.current = setInterval(() => {
                const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
                setState(prev => ({ ...prev, duration: elapsed }));

                // Auto-stop at max duration
                if (elapsed >= MAX_DURATION_SECONDS) {
                    stopRecording();
                }
            }, 100);

            setState(prev => ({
                ...prev,
                isRecording: true,
                isPreparing: false,
                duration: 0,
            }));
        } catch (error) {
            // Recording start failed
            setState(prev => ({
                ...prev,
                isRecording: false,
                isPreparing: false,
                error: 'Failed to start recording. Please try again.',
            }));
        }
    }, [state.hasPermission, requestPermission]);

    // Stop recording and get audio data
    const stopRecording = useCallback(async (): Promise<{ audioBase64: string; duration: number } | null> => {
        try {
            // Clear duration interval
            if (durationIntervalRef.current) {
                clearInterval(durationIntervalRef.current);
                durationIntervalRef.current = null;
            }

            if (!recordingRef.current) {
                setState(prev => ({ ...prev, isRecording: false }));
                return null;
            }

            const recording = recordingRef.current;

            // Stop recording
            await recording.stopAndUnloadAsync();
            const uri = recording.getURI();
            recordingRef.current = null;

            // Calculate final duration
            const finalDuration = Math.floor((Date.now() - startTimeRef.current) / 1000);

            // Reset audio mode
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: false,
            });

            setState(prev => ({
                ...prev,
                isRecording: false,
                duration: finalDuration,
            }));

            if (!uri) {
                setState(prev => ({ ...prev, error: 'No recording data received' }));
                return null;
            }

            // Convert to base64
            const base64 = await FileSystem.readAsStringAsync(uri, {
                encoding: FileSystem.EncodingType.Base64,
            });

            // Clean up file
            try {
                await FileSystem.deleteAsync(uri, { idempotent: true });
            } catch (e) {
                // Ignore cleanup errors
            }

            return {
                audioBase64: base64,
                duration: finalDuration,
            };
        } catch (error) {
            // Recording stop failed
            setState(prev => ({
                ...prev,
                isRecording: false,
                error: 'Failed to process recording',
            }));
            return null;
        }
    }, []);

    // Cancel recording without saving
    const cancelRecording = useCallback(async () => {
        // Clear duration interval
        if (durationIntervalRef.current) {
            clearInterval(durationIntervalRef.current);
            durationIntervalRef.current = null;
        }

        if (recordingRef.current) {
            try {
                await recordingRef.current.stopAndUnloadAsync();
                const uri = recordingRef.current.getURI();
                recordingRef.current = null;

                // Clean up file
                if (uri) {
                    await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => { });
                }

                // Reset audio mode
                await Audio.setAudioModeAsync({
                    allowsRecordingIOS: false,
                });
            } catch (error) {
                // Recording cancel failed silently
            }
        }

        setState(prev => ({
            ...prev,
            isRecording: false,
            isPreparing: false,
            duration: 0,
            error: null,
        }));
    }, []);

    return {
        state,
        startRecording,
        stopRecording,
        cancelRecording,
        requestPermission,
    };
}

export default useVoiceRecording;
