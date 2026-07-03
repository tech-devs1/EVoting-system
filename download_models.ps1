$dest = "C:\vote\EVoting-system\frontend\public\models\"
$base = "https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/"

$files = @(
    "tiny_face_detector_model-weights_manifest.json",
    "tiny_face_detector_model-shard1",
    "face_landmark_68_model-weights_manifest.json",
    "face_landmark_68_model-shard1",
    "face_recognition_model-weights_manifest.json",
    "face_recognition_model-shard1",
    "face_recognition_model-shard2"
)

foreach ($file in $files) {
    Write-Host "Downloading $file..."
    Invoke-WebRequest -Uri ($base + $file) -OutFile ($dest + $file) -UseBasicParsing
}

Write-Host "All models downloaded successfully."
