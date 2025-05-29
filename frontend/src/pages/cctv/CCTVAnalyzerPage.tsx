import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  X,
  ArrowLeft,
  Video,
  Camera,
  AlertCircle,
  Play,
  Pause,
  Film,
  Loader2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { convertAnalysisToReport } from "./VideoAnalysisReport";

interface FileUploadProps {
  accept: string;
  maxSize: number;
  onFileSelect: (file: File) => void;
  type: "video" | "image";
  selectedFile?: File | null;
  previewUrl?: string;
  onRemove?: () => void;
}

const FileUpload: React.FC<FileUploadProps> = ({
  accept,
  maxSize,
  onFileSelect,
  type,
  selectedFile,
  previewUrl,
  onRemove,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string>("");

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragging(true);
    } else if (e.type === "dragleave") {
      setIsDragging(false);
    }
  };

  const validateFile = (file: File): boolean => {
    if (file.size > maxSize) {
      setError(
        `File size must be less than ${maxSize / (1024 * 1024 * 1024)} GB`
      );
      return false;
    }
    setError("");
    return true;
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files[0] && validateFile(files[0])) {
      onFileSelect(files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0] && validateFile(files[0])) {
      onFileSelect(files[0]);
    }
  };

  if (type === "image" && previewUrl) {
    return (
      <div className="relative w-full h-full rounded-xl overflow-hidden bg-gray-800 flex items-center justify-center">
        <div className="relative w-full h-full">
          <img
            src={previewUrl}
            alt="Preview"
            className="absolute inset-0 w-full h-full object-contain"
          />
          {onRemove && (
            <button
              onClick={onRemove}
              className="absolute top-2 right-2 p-2 bg-red-500 rounded-full text-white
                hover:bg-red-600 transition-colors z-10"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    );
  }

  const acceptText =
    type === "video" ? "MP4, AVI (up to 4 GB)" : "PNG, JPG, JPEG (up to 5 MB)";

  return (
    <div
      onClick={() => fileInputRef.current?.click()}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      className={`relative w-full h-full rounded-xl border-2 border-dashed
        transition-all cursor-pointer flex flex-col items-center justify-center p-6
        ${isDragging
          ? "border-blue-500 bg-blue-50/10"
          : "border-gray-600 hover:border-blue-500"
        }
        ${selectedFile ? "bg-gray-800" : "bg-gray-800/50"}
        hover:shadow-lg hover:shadow-blue-500/10`}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileSelect}
        className="hidden"
      />

      {selectedFile ? (
        <div className="text-center">
          <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 rounded-full bg-blue-500/20">
            {type === "video" ? (
              <Video className="w-8 h-8 text-blue-500" />
            ) : (
              <Camera className="w-8 h-8 text-blue-500" />
            )}
          </div>
          <p className="text-blue-500 font-medium mb-1">{selectedFile.name}</p>
          <p className="text-gray-400 text-sm">
            {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
          </p>
          {onRemove && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              className="mt-4 p-2 bg-red-500 rounded-full text-white
                hover:bg-red-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      ) : (
        <>
          <div
            className="flex items-center justify-center w-20 h-20 mb-4 rounded-full bg-gray-700
            transition-transform group-hover:scale-110"
          >
            <Upload className="w-10 h-10 text-gray-400" />
          </div>
          <p className="text-gray-300 font-medium mb-2">
            Click to upload{" "}
            {type === "video" ? "video footage" : "suspect image"}
          </p>
          <p className="text-gray-500 text-sm mb-2">or drag and drop</p>
          <p className="text-gray-400 text-xs">
            Supported formats: {acceptText}
          </p>
        </>
      )}

      {error && (
        <div className="mt-4 p-4 bg-red-500/20 border border-red-500 rounded-lg">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <p className="text-red-500">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
};

interface AnalysisResult {
  suspectName: string;
  timestamp: string;
  screenshot: string;
  videoClip?: string;
}

interface AnalysisStats {
  framesProcessed: number;
  matchesFound: number;
}

interface ProcessingDisplayProps {
  progress: number;
}

const ProcessingDisplay: React.FC<ProcessingDisplayProps> = ({
  progress
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="bg-gray-800/50 rounded-xl p-8"
    >
      <div className="mt-8">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-blue-400">
            <Film className="w-5 h-5" />
            <span>Processing Video</span>
          </div>
          <span className="text-gray-400">{Math.min(progress, 100)}%</span>
        </div>
        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 transition-all duration-300"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
      </div>
      
      <div className="mt-8 flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
      </div>
      
      <div className="mt-4 text-center text-gray-400">
        <p>Your video is being analyzed</p>
        <p className="text-sm mt-2">This may take several minutes depending on the video length</p>
      </div>
    </motion.div>
  );
};

const CCTVAnalyzerPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"existing" | "new">("existing");
  const [existingVideo, setExistingVideo] = useState<File | null>(null);
  const [suspectName, setSuspectName] = useState("");
  const [crimeDescription, setCrimeDescription] = useState("");
  const [suspectImage, setSuspectImage] = useState<File | null>(null);
  const [suspectImagePreview, setSuspectImagePreview] = useState<string>("");
  const [newVideo, setNewVideo] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [results, setResults] = useState<AnalysisResult[]>([]);
  const [stats, setStats] = useState<AnalysisStats | null>(null);
  const [processingTime, setProcessingTime] = useState<number | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // API base URL
  const API_BASE_URL = "/api"; // Using Vite's proxy to avoid CORS issues

  const handleSuspectImageSelect = (file: File) => {
    setSuspectImage(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setSuspectImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setAnalysisProgress(0);
    setResults([]);
    setStats(null);
    setProcessingTime(null);
    setError(null);

    try {
      const videoToUse = activeTab === "existing" ? existingVideo : newVideo;
      if (!videoToUse) {
        throw new Error("No video selected");
      }

      // If adding a new suspect, upload the suspect image first
      if (activeTab === "new" && suspectImage) {
        const suspectFormData = new FormData();
        suspectFormData.append("suspect_image", suspectImage);
        suspectFormData.append("suspect_name", suspectName);
        suspectFormData.append("police_station", crimeDescription || "Unknown Police Station");

        const suspectResponse = await fetch(`${API_BASE_URL}/upload-suspect`, {
          method: "POST",
          body: suspectFormData,
        });

        if (!suspectResponse.ok) {
          const errorData = await suspectResponse.json();
          throw new Error(errorData.message || "Failed to upload suspect");
        }

        const suspectData = await suspectResponse.json();
        console.log("Suspect added successfully:", suspectData);
      }

      // Upload the video
      const formData = new FormData();
      formData.append("video", videoToUse);

      const uploadResponse = await fetch(`${API_BASE_URL}/upload-video`, {
        method: "POST",
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload video");
      }

      const uploadData = await uploadResponse.json();
      const { task_id } = uploadData;
      setTaskId(task_id);

      // Start analysis
      const analyzeResponse = await fetch(`${API_BASE_URL}/analyze-video/${task_id}`, {
        method: "POST",
      });

      if (!analyzeResponse.ok) {
        throw new Error("Failed to start analysis");
      }

      // Poll for status updates
      const statusInterval = setInterval(async () => {
        try {
          const statusResponse = await fetch(`${API_BASE_URL}/analysis-status/${task_id}`);

          if (!statusResponse.ok) {
            clearInterval(statusInterval);
            throw new Error("Failed to get analysis status");
          }

          const statusData = await statusResponse.json();

          setAnalysisProgress(statusData.progress);

          if (statusData.status === "completed") {
            clearInterval(statusInterval);
            setIsAnalyzing(false);

            // Format the results to match our expected format
            if (statusData.results && Array.isArray(statusData.results)) {
              const formattedResults = statusData.results.map((result: any) => ({
                suspectName: result.suspectName,
                timestamp: result.timestamp,
                screenshot: `${API_BASE_URL}${result.screenshot}`,
                videoClip: `${API_BASE_URL}/detected_clips_original/${result.suspectName}_${result.timestamp.replace(/[: ]/g, '_')}.mp4`
              }));

              setResults(formattedResults);
              setStats(statusData.stats);
              setProcessingTime(statusData.processing_time);
            }
          }
        } catch (err) {
          clearInterval(statusInterval);
          console.error("Error polling status:", err);
          setError(err instanceof Error ? err.message : "Unknown error");
          setIsAnalyzing(false);
        }
      }, 1000);

    } catch (err) {
      console.error("Analysis error:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
      setIsAnalyzing(false);
    }
  };

  const groupedResults = React.useMemo(() => {
    return Object.entries(
      results.reduce((acc, result) => {
        if (!acc[result.suspectName]) {
          acc[result.suspectName] = [];
        }
        acc[result.suspectName].push(result);
        return acc;
      }, {} as Record<string, AnalysisResult[]>)
    );
  }, [results]);

  const handleViewReport = () => {
    if (!stats || !processingTime || !results.length) return;

    const videoName =
      activeTab === "existing" && existingVideo
        ? existingVideo.name
        : newVideo
          ? newVideo.name
          : "unknown";

    const reportData = convertAnalysisToReport(
      results,
      stats,
      processingTime,
      videoName
    );

    navigate("/analyze/report", { state: { reportData } });
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-4 mb-12">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate("/home")}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Home</span>
          </motion.button>
        </div>

        <div className="py-2 mb-4">
          <motion.h1
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-5xl font-bold mb-8 text-center bg-clip-text text-transparent 
              bg-gradient-to-r from-blue-500 to-purple-500 drop-shadow-lg
              hover:from-purple-500 hover:to-blue-500 transition-all duration-500
              cursor-default px-4 py-2 leading-normal"
          >
            CCTV Footage Analyzer
          </motion.h1>
        </div>

        <div className="flex flex-col gap-8">
          <div className="flex gap-4">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setActiveTab("existing")}
              className={`flex-1 py-4 px-6 rounded-xl font-semibold text-lg transition-all
                ${activeTab === "existing"
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                }`}
            >
              Check Existing Suspects
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setActiveTab("new")}
              className={`flex-1 py-4 px-6 rounded-xl font-semibold text-lg transition-all
                ${activeTab === "new"
                  ? "bg-purple-600 text-white shadow-lg shadow-purple-500/20"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                }`}
            >
              Add New Suspect
            </motion.button>
          </div>

          <AnimatePresence mode="wait">
            {!isAnalyzing ? (
              activeTab === "existing" ? (
                <motion.div
                  key="existing"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="bg-gray-800/50 rounded-xl p-8"
                >
                  <FileUpload
                    accept="video/mp4,video/avi"
                    maxSize={4 * 1024 * 1024 * 1024}
                    onFileSelect={setExistingVideo}
                    type="video"
                    selectedFile={existingVideo}
                    onRemove={() => setExistingVideo(null)}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="new"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="bg-gray-800/50 rounded-xl p-8 flex flex-col gap-8"
                >
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Suspect Name
                      </label>
                      <input
                        type="text"
                        value={suspectName}
                        onChange={(e) => setSuspectName(e.target.value)}
                        className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg
                          focus:ring-2 focus:ring-purple-500 focus:border-transparent
                          placeholder-gray-400 text-white"
                        placeholder="Enter full name of the suspect"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Crime Description
                      </label>
                      <textarea
                        value={crimeDescription}
                        onChange={(e) => setCrimeDescription(e.target.value)}
                        className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg
                          focus:ring-2 focus:ring-purple-500 focus:border-transparent
                          placeholder-gray-400 text-white resize-none h-32"
                        placeholder="Enter the crime details..."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Police Station
                      </label>
                      <input
                        type="text"
                        value="Kharghar Police Station"
                        disabled
                        className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg
                          text-gray-400 cursor-not-allowed"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6 h-[400px]">
                    <div className="h-full">
                      <p className="text-sm font-medium text-gray-300 mb-4">
                        Suspect Image
                      </p>
                      <div className="h-[calc(100%-2rem)]">
                        <FileUpload
                          accept="image/png,image/jpeg,image/jpg"
                          maxSize={5 * 1024 * 1024}
                          onFileSelect={handleSuspectImageSelect}
                          type="image"
                          selectedFile={suspectImage}
                          previewUrl={suspectImagePreview}
                          onRemove={() => {
                            setSuspectImage(null);
                            setSuspectImagePreview("");
                          }}
                        />
                      </div>
                    </div>
                    <div className="h-full">
                      <p className="text-sm font-medium text-gray-300 mb-4">
                        CCTV Footage
                      </p>
                      <div className="h-[calc(100%-2rem)]">
                        <FileUpload
                          accept="video/mp4,video/avi"
                          maxSize={4 * 1024 * 1024 * 1024}
                          onFileSelect={setNewVideo}
                          type="video"
                          selectedFile={newVideo}
                          onRemove={() => setNewVideo(null)}
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
              )
            ) : (
              <ProcessingDisplay
                progress={analysisProgress}
              />
            )}
          </AnimatePresence>

          {!isAnalyzing && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-center gap-4"
            >
              {activeTab === "new" && suspectImage && suspectName && (
                <button
                  onClick={async () => {
                    try {
                      setIsAnalyzing(true);
                      const suspectFormData = new FormData();
                      suspectFormData.append("suspect_image", suspectImage);
                      suspectFormData.append("suspect_name", suspectName);
                      suspectFormData.append("police_station", crimeDescription || "Unknown Police Station");
                      
                      const suspectResponse = await fetch(`${API_BASE_URL}/upload-suspect`, {
                        method: "POST",
                        body: suspectFormData,
                      });
                      
                      if (!suspectResponse.ok) {
                        const errorData = await suspectResponse.json();
                        throw new Error(errorData.message || "Failed to upload suspect");
                      }
                      
                      const suspectData = await suspectResponse.json();
                      alert(suspectData.message || "Suspect added successfully!");
                    } catch (err) {
                      console.error("Upload error:", err);
                      setError(err instanceof Error ? err.message : "Unknown error");
                    } finally {
                      setIsAnalyzing(false);
                    }
                  }}
                  disabled={isAnalyzing}
                  className={`px-8 py-4 rounded-xl font-semibold text-lg
                    transition-all duration-300 transform hover:scale-105 min-w-[200px]
                    ${isAnalyzing
                      ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                      : "bg-gradient-to-r from-green-600 to-blue-600 text-white hover:shadow-lg hover:shadow-green-500/20"
                    }`}
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline" />
                      Uploading Suspect...
                    </>
                  ) : (
                    "Upload Suspect Only"
                  )}
                </button>
              )}
              
              <button
                onClick={handleAnalyze}
                disabled={
                  isAnalyzing ||
                  (activeTab === "existing"
                    ? !existingVideo
                    : !suspectImage || !newVideo)
                }
                className={`px-8 py-4 rounded-xl font-semibold text-lg
                  transition-all duration-300 transform hover:scale-105 min-w-[200px]
                  ${isAnalyzing ||
                    (activeTab === "existing"
                      ? !existingVideo
                      : !suspectImage || !newVideo)
                    ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                    : "bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:shadow-lg hover:shadow-blue-500/20"
                  }`}
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline" />
                    Analyzing Video...
                  </>
                ) : activeTab === "new" ? (
                  "Analyze Video & Add Suspect"
                ) : (
                  "Analyze Video"
                )}
              </button>
            </motion.div>
          )}

          {groupedResults.length > 0 && (
            <div className="bg-gray-800/50 rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-semibold text-white">
                    Analysis Results
                  </h2>
                  {stats && (
                    <div className="mt-1 text-sm text-gray-400">
                      <p>
                        Processed {stats.framesProcessed.toLocaleString()}{" "}
                        frames in {processingTime?.toFixed(2)} seconds
                      </p>
                      <p>Found {stats.matchesFound} matches</p>
                    </div>
                  )}
                </div>
                <div className="flex items-center space-x-4">
                  {stats &&
                    processingTime &&
                    (activeTab === "existing" ? existingVideo : newVideo) && (
                      <button
                        onClick={handleViewReport}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg
                        hover:bg-blue-700 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span>Preview Download</span>
                        </div>
                      </button>
                    )}
                </div>
              </div>

              <div className="space-y-6">
                {groupedResults.map(([suspectName, suspectResults]) => (
                  <div key={suspectName} className="bg-gray-700/50 rounded-lg">
                    <div className="px-4 py-3 border-b border-gray-600">
                      <h3 className="text-lg font-medium text-white">
                        Suspect: {suspectName}
                      </h3>
                      <p className="text-sm text-gray-400">
                        {suspectResults.length} appearances detected
                      </p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
                      {suspectResults.map((result, index) => (
                        <div
                          key={index}
                          className="bg-gray-800 rounded-lg overflow-hidden"
                        >
                          {result.videoClip ? (
                            <div className="aspect-video">
                              <video
                                src={result.videoClip}
                                controls
                                className="w-full h-full object-cover"
                                poster={result.screenshot}
                                onError={(e) => {
                                  // Fallback to screenshot if video fails to load
                                  const target = e.target as HTMLVideoElement;
                                  const parent = target.parentElement;
                                  if (parent) {
                                    const img = document.createElement('img');
                                    img.src = result.screenshot;
                                    img.className = "w-full h-full object-cover";
                                    img.alt = `Detection at ${result.timestamp}`;
                                    parent.innerHTML = '';
                                    parent.appendChild(img);
                                  }
                                }}
                              />
                            </div>
                          ) : (
                            <div className="aspect-video">
                              <img
                                src={result.screenshot}
                                alt={`Detection at ${result.timestamp}`}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          )}
                          <div className="p-3">
                            <p className="text-sm text-gray-300">
                              Timestamp: {result.timestamp}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CCTVAnalyzerPage;
