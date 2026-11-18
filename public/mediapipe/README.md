# Local MediaPipe assets

SDK: @mediapipe/tasks-vision 1.2.3. The `wasm/` files are copied from this exact installed SDK version. Keep them in sync when updating the dependency.

Models downloaded from Google MediaPipe model hosting:

- Selfie Segmenter (square, float16): https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite
- Hand Landmarker (float16, version 1): https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task
- Face Landmarker (float16, version 1): https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task

The app loads these assets from its own origin. Camera frames stay in the browser and are not uploaded to a server. Both models and both WebAssembly variants are included in the production `dist/mediapipe/` output.

Official documentation:

- https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker/web_js
- https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker/web_js
