import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Camera, AlertCircle, Upload,
  UserPlus, Play, Loader2, Video, VideoOff
} from 'lucide-react';

// API endpoint constants
const API_BASE_URL = 'http://localhost:8000';
const UPLOAD_SUSPECT_ENDPOINT = `${API_BASE_URL}/upload-suspect`;
const PROCESS_FRAME_ENDPOINT = `${API_BASE_URL}/process-live-frame`;

// Performance settings
const FRAME_PROCESS_INTERVAL = 500; // Process frames every 500ms instead of every frame
const IMAGE_QUALITY = 0.6; // Lower image quality for faster processing

interface Suspect {
  id: string;
  name: string;
  crime: string;
  photo: File;
  photoPreview: string;
}

interface Detection {
  bbox: number[];
  name: string;
  location: string;
  similarity: number;
  recognized: boolean;
  image_path?: string;
}

const LiveDetectionPage: React.FC = () => {
  const navigate = useNavigate();
  const [suspects, setSuspects] = useState<Suspect[]>([]);
  const [currentName, setCurrentName] = useState('');
  const [currentCrime, setCurrentCrime] = useState('');
  const [currentPhoto, setCurrentPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [detectedSuspect, setDetectedSuspect] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // New state for webcam
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [processingEnabled, setProcessingEnabled] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number | null>(null);
  const processingAnimationRef = useRef<NodeJS.Timeout | null>(null);

  // Additional refs for performance optimization
  const lastProcessedTime = useRef<number>(0);
  const processingInProgress = useRef<boolean>(false);
  const [frameRate, setFrameRate] = useState<number>(0);
  const frameCounter = useRef<number>(0);
  const lastFpsUpdateTime = useRef<number>(performance.now());
  const currentDetectionsRef = useRef<Detection[]>([]);

  // Simulated police station data from login session
  const policeStation = "Kharghar Police Station";

  // Function to draw video frame to canvas (separate from processing)
  const drawVideoFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || !isStreaming) {
      return;
    }

    const canvas = canvasRef.current;
    const video = videoRef.current;
    const context = canvas.getContext('2d');

    if (!context) {
      return;
    }

    // Ensure canvas dimensions match video for proper display
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }

    // Draw video to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Draw any existing detections
    if (currentDetectionsRef.current.length > 0) {
      currentDetectionsRef.current.forEach((detection: Detection) => {
        const [x1, y1, x2, y2] = detection.bbox;
        
        // Draw bounding box with optimized rendering
        context.strokeStyle = detection.recognized ? '#00ff00' : '#ff0000';
        context.lineWidth = 2;
        context.strokeRect(x1, y1, x2 - x1, y2 - y1);
        
        // Optimize label rendering
        const labelText = `${detection.name} (${detection.similarity.toFixed(2)})`;
        const labelWidth = context.measureText(labelText).width + 10;
        
        // Draw label background
        context.fillStyle = detection.recognized ? 'rgba(0, 255, 0, 0.7)' : 'rgba(255, 0, 0, 0.7)';
        context.fillRect(x1, y1 - 25, labelWidth, 25);
        
        // Draw label text
        context.fillStyle = '#ffffff';
        context.font = '16px Arial';
        context.fillText(labelText, x1 + 5, y1 - 5);
      });
    }

    // Calculate FPS
    const now = performance.now();
    frameCounter.current++;
    
    if (now - lastFpsUpdateTime.current >= 1000) {
      // Update FPS every second
      setFrameRate(Math.round((frameCounter.current * 1000) / (now - lastFpsUpdateTime.current)));
      frameCounter.current = 0;
      lastFpsUpdateTime.current = now;
    }

    // Continue animation loop for smooth display
    animationRef.current = requestAnimationFrame(drawVideoFrame);
  }, [isStreaming]);

  // Separate function to process frames at intervals
  const processFrame = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !processingEnabled) {
      return;
    }

    const now = performance.now();
    
    // Throttle the processing to improve performance
    const shouldProcess = now - lastProcessedTime.current >= FRAME_PROCESS_INTERVAL && !processingInProgress.current;
    
    if (shouldProcess && videoRef.current.videoWidth > 0 && videoRef.current.videoHeight > 0) {
      processingInProgress.current = true;
      lastProcessedTime.current = now;

      try {
        const canvas = canvasRef.current;
        // Get image data from canvas with reduced quality
        const imageData = canvas.toDataURL('image/jpeg', IMAGE_QUALITY);

        // Send to backend for processing with improved error handling
        const response = await fetch(PROCESS_FRAME_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({ image: imageData }),
          mode: 'cors', // Explicitly set CORS mode
        });

        if (!response.ok) {
          // Log error but don't throw to allow continuous processing
          console.error(`Frame processing error: ${response.status} ${response.statusText}`);
          processingInProgress.current = false;
          return;
        }

        const result = await response.json();

        if (result.status === 'success') {
          // Update detections
          setDetections(result.detections || []);
          currentDetectionsRef.current = result.detections || [];

          // Find recognized suspects
          const recognizedSuspects = result.detections?.filter(
            (detection: Detection) => detection.recognized
          );

          if (recognizedSuspects?.length > 0) {
            // Set the first recognized suspect as detected
            setDetectedSuspect(recognizedSuspects[0].name);
            
            // Clear the detection after 3 seconds
            setTimeout(() => {
              setDetectedSuspect(null);
            }, 3000);
          }
        }
      } catch (err) {
        console.error('Error processing frame:', err);
      } finally {
        processingInProgress.current = false;
      }
    }

    // Schedule next processing attempt
    processingAnimationRef.current = setTimeout(() => {
      if (processingEnabled) {
        processFrame();
      }
    }, 100); // Check if we need to process more frequently than the actual processing interval
  }, [processingEnabled]);

  // Start webcam
  const startWebcam = async () => {
    try {
      setCameraError(null);
      
      // If there's an existing stream, stop it first
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      
      // Request camera access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        },
        audio: false
      });
      
      // Store stream reference
      streamRef.current = stream;
      
      // Connect stream to video element
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // Make sure video plays when loaded
        videoRef.current.onloadedmetadata = () => {
          if (videoRef.current) {
            videoRef.current.play().catch(e => {
              console.error('Error playing video:', e);
              setCameraError('Failed to play video stream. Please try again.');
            });
          }
        };
      }
      
      setIsStreaming(true);
      console.log('Camera started successfully');
    } catch (err) {
      console.error('Failed to access webcam:', err);
      setCameraError('Failed to access webcam. Please make sure your camera is connected and permissions are granted.');
      setIsStreaming(false);
    }
  };

  // Stop webcam
  const stopWebcam = () => {
    // Stop the animation frames
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    
    if (processingAnimationRef.current) {
      clearTimeout(processingAnimationRef.current);
      processingAnimationRef.current = null;
    }
    
    // Stop all tracks in the stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    // Clear video source
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    setIsStreaming(false);
    setProcessingEnabled(false);
    setDetections([]);
    currentDetectionsRef.current = [];
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCurrentPhoto(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddSuspect = async () => {
    if (!currentName || !currentCrime || !currentPhoto) {
      setError('Please fill in all fields and upload a photo');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      // Create form data to send to the backend
      const formData = new FormData();
      formData.append('suspect_image', currentPhoto);
      formData.append('suspect_name', currentName);
      formData.append('police_station', policeStation);

      // Send to the backend API with improved error handling
      const response = await fetch(UPLOAD_SUSPECT_ENDPOINT, {
        method: 'POST',
        body: formData,
        mode: 'cors', // Explicitly set CORS mode
        headers: {
          // Don't set Content-Type when using FormData
          // Browser will set it automatically with the correct boundary
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        // Try to parse error message if available
        try {
          const errorData = await response.json();
          throw new Error(errorData.message || `Server error: ${response.status}`);
        } catch (parseError) {
          // If JSON parsing fails, use status text
          throw new Error(`Server error: ${response.status} ${response.statusText}`);
        }
      }

      const result = await response.json();

      // If upload successful, add to local state
      const newSuspect: Suspect = {
        id: Date.now().toString(),
        name: currentName,
        crime: currentCrime,
        photo: currentPhoto,
        photoPreview: photoPreview
      };

      setSuspects([...suspects, newSuspect]);
      setCurrentName('');
      setCurrentCrime('');
      setCurrentPhoto(null);
      setPhotoPreview('');

    } catch (err) {
      console.error("Upload error:", err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred during upload');
    } finally {
      setIsUploading(false);
    }
  };

  const startDetection = () => {
    if (suspects.length === 0) {
      setError('Please add at least one suspect before starting detection');
      return;
    }

    setIsProcessing(true);
    setError(null);

    // Start webcam if not already streaming
    if (!isStreaming) {
      startWebcam();
    } else {
      // If already streaming, just start processing
      setProcessingEnabled(true);
      processFrame();
    }
    
    // After 3 seconds, show that processing has completed
    setTimeout(() => {
      setIsProcessing(false);
    }, 3000);
  };

  // Effect to start video rendering and processing when streaming is active
  useEffect(() => {
    if (isStreaming) {
      // Start rendering video frames continuously for smooth display
      animationRef.current = requestAnimationFrame(drawVideoFrame);
      
      // If processing is enabled, start the processing loop
      if (processingEnabled) {
        processFrame();
      }
    }
    
    // Clean up
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      
      if (processingAnimationRef.current) {
        clearTimeout(processingAnimationRef.current);
      }
    };
  }, [isStreaming, processingEnabled, drawVideoFrame, processFrame]);

  // Effect to handle webcam starts when isStreaming changes to true
  useEffect(() => {
    if (isStreaming) {
      // Make sure video element loads and plays
      if (videoRef.current && !videoRef.current.srcObject && streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
        videoRef.current.play().catch(e => {
          console.error('Error playing video:', e);
          setCameraError('Failed to play video stream. Please try again.');
        });
      }
    }
  }, [isStreaming]);

  // Clean up resources when component unmounts
  useEffect(() => {
    return () => {
      stopWebcam();
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-4 mb-12">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/home')}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Home</span>
          </motion.button>

          {/* Camera toggle controls */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={isStreaming ? stopWebcam : startWebcam}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              isStreaming 
                ? 'bg-red-600 hover:bg-red-700' 
                : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            {isStreaming ? (
              <>
                <VideoOff className="w-5 h-5" />
                <span>Stop Camera</span>
              </>
            ) : (
              <>
                <Video className="w-5 h-5" />
                <span>Start Camera</span>
              </>
            )}
          </motion.button>
        </div>

        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-5xl font-bold mb-12 text-center bg-clip-text text-transparent 
            bg-gradient-to-r from-blue-500 to-purple-500"
        >
          Live CCTV Detection
        </motion.h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Form Section */}
          <div className="space-y-8">
            <div className="bg-gray-800 rounded-xl p-6 space-y-6">
              <h2 className="text-2xl font-semibold">Add Suspects for Detection</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Suspect Name
                  </label>
                  <input
                    type="text"
                    value={currentName}
                    onChange={(e) => setCurrentName(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg
                      focus:ring-2 focus:ring-blue-500 focus:border-transparent
                      placeholder-gray-400"
                    placeholder="Enter suspect's name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Crime Details
                  </label>
                  <input
                    type="text"
                    value={currentCrime}
                    onChange={(e) => setCurrentCrime(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg
                      focus:ring-2 focus:ring-blue-500 focus:border-transparent
                      placeholder-gray-400"
                    placeholder="Enter crime details"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Police Station
                  </label>
                  <input
                    type="text"
                    value={policeStation}
                    disabled
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg
                      text-gray-400 cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Suspect Photo
                  </label>
                  <div
                    onClick={() => document.getElementById('photoUpload')?.click()}
                    className="relative aspect-video rounded-lg border-2 border-dashed
                      border-gray-600 hover:border-blue-500 transition-colors cursor-pointer
                      bg-gray-700 flex items-center justify-center overflow-hidden"
                  >
                    {photoPreview ? (
                      <img
                        src={photoPreview}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-center">
                        <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-400">Click to upload photo</p>
                      </div>
                    )}
                  </div>
                  <input
                    id="photoUpload"
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoChange}
                    className="hidden"
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-red-500 bg-red-500/10 p-3 rounded-lg">
                  <AlertCircle className="w-5 h-5" />
                  <span className="text-sm">{error}</span>
                </div>
              )}

              <button
                onClick={handleAddSuspect}
                disabled={isUploading}
                className="w-full flex items-center justify-center gap-2 px-4 py-2
                  bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors
                  disabled:bg-blue-800 disabled:cursor-not-allowed"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <UserPlus className="w-5 h-5" />
                    Add Suspect
                  </>
                )}
              </button>
            </div>

            {/* Suspects List */}
            <AnimatePresence>
              {suspects.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="bg-gray-800 rounded-xl p-6"
                >
                  <h3 className="text-xl font-semibold mb-4">Added Suspects</h3>
                  <div className="space-y-4">
                    {suspects.map((suspect) => (
                      <motion.div
                        key={suspect.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        className="flex items-center gap-4 bg-gray-700 rounded-lg p-4"
                      >
                        <img
                          src={suspect.photoPreview}
                          alt={suspect.name}
                          className="w-16 h-16 rounded-lg object-cover"
                        />
                        <div className="flex-1">
                          <h4 className="font-medium">{suspect.name}</h4>
                          <p className="text-sm text-gray-400">{suspect.crime}</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Live Detection Section */}
          <div className="space-y-8">
            <div className="bg-gray-800 rounded-xl p-6">
              <div className="aspect-video rounded-lg bg-black relative overflow-hidden">
                {isStreaming ? (
                  <>
                    {/* Camera feed - hidden but used as source */}
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="hidden"
                    />
                    
                    {/* Canvas for drawing video and detections */}
                    <canvas
                      ref={canvasRef}
                      className="absolute inset-0 w-full h-full object-cover z-10"
                      style={{ transform: 'scaleX(-1)' }}
                    />
                    
                    {/* Debugging info */}
                    <div className="absolute top-24 left-4 text-xs text-white z-30 bg-black/50 p-1 rounded">
                      {videoRef.current?.videoWidth || 0}x{videoRef.current?.videoHeight || 0} | {frameRate} FPS
                    </div>
                    
                    {/* Live indicator */}
                    <div className="absolute bottom-4 left-4 flex items-center gap-2 z-20">
                      <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                      <span className="text-sm">Live</span>
                    </div>
                    
                    {/* Status indicator */}
                    {processingEnabled && (
                      <div className="absolute top-4 right-4 bg-blue-500/80 px-3 py-1 rounded-full text-xs font-medium z-20">
                        Detection Active
                      </div>
                    )}
                  </>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Camera className="w-16 h-16 text-gray-600" />
                    <p className="absolute mt-20 text-gray-400">Camera not active</p>
                  </div>
                )}
                
                {/* Camera error message */}
                {cameraError && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                    <div className="text-center p-4">
                      <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
                      <p className="text-red-400">{cameraError}</p>
                    </div>
                  </div>
                )}

                {/* Detection Alert */}
                <AnimatePresence>
                  {detectedSuspect && (
                    <motion.div
                      initial={{ opacity: 0, y: 50 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 50 }}
                      className="absolute top-4 left-4 right-4 bg-red-500/90 text-white p-4 rounded-lg
                        backdrop-blur-sm flex items-center gap-3 z-20"
                    >
                      <AlertCircle className="w-6 h-6" />
                      <span className="font-medium">
                        Suspect Detected: {detectedSuspect}
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="mt-6">
                <button
                  onClick={startDetection}
                  disabled={isProcessing || suspects.length === 0}
                  className={`w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg
                    font-medium transition-all ${isProcessing || suspects.length === 0
                      ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                      : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:shadow-lg hover:shadow-blue-500/20'
                    }`}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Play className="w-5 h-5" />
                      Start Detection
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Detection Stats */}
            <div className="bg-gray-800 rounded-xl p-6">
              <h3 className="text-xl font-semibold mb-4">Detection Stats</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-700 rounded-lg p-4">
                  <p className="text-sm text-gray-400">Suspects Added</p>
                  <p className="text-2xl font-bold">{suspects.length}</p>
                </div>
                <div className="bg-gray-700 rounded-lg p-4">
                  <p className="text-sm text-gray-400">Detection Status</p>
                  <p className="text-2xl font-bold">
                    {processingEnabled ? 'Active' : 'Inactive'}
                  </p>
                </div>
              </div>
              
              {/* Last 3 detections */}
              {detections.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm text-gray-400 mb-2">Recent Detections</p>
                  <div className="space-y-2">
                    {detections.slice(0, 3).map((detection, index) => (
                      <div 
                        key={index} 
                        className={`px-3 py-2 rounded text-sm ${
                          detection.recognized 
                            ? 'bg-green-500/20 text-green-300' 
                            : 'bg-red-500/20 text-red-300'
                        }`}
                      >
                        {detection.name} - {detection.similarity.toFixed(2)} similarity
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveDetectionPage;