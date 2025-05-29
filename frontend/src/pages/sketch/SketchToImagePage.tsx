import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, Image as ImageIcon, Loader2, Download } from 'lucide-react';

const SketchToImagePage: React.FC = () => {
  const navigate = useNavigate();
  const [sketch, setSketch] = useState<File | null>(null);
  const [sketchPreview, setSketchPreview] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string>('');
  const [error, setError] = useState<string>('');

  const handleSketchUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSketch(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setSketchPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerate = async () => {
    if (!sketch) return;

    setIsProcessing(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('sketch', sketch);

      const response = await fetch('http://localhost:8000/sketch-to-image', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.status === 'error') {
        setError(data.message || 'An error occurred during image generation');
      } else {
        setGeneratedImage(data.generated_image);
      }
    } catch (err) {
      console.error('Error generating image:', err);
      setError('Failed to connect to the server. Please try again later.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (generatedImage) {
      const link = document.createElement('a');
      link.href = generatedImage;
      link.download = 'generated-image.png';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-6xl mx-auto">
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
        </div>

        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-5xl font-bold mb-12 text-center bg-clip-text text-transparent 
            bg-gradient-to-r from-purple-500 to-pink-500"
        >
          Sketch to Image Converter
        </motion.h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Sketch Upload */}
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold mb-4">Upload Sketch</h2>
            <div
              onClick={() => document.getElementById('sketchUpload')?.click()}
              className={`aspect-square rounded-xl border-2 border-dashed
                ${sketch ? 'border-purple-500' : 'border-gray-600'}
                hover:border-purple-500 transition-colors cursor-pointer
                flex items-center justify-center bg-gray-800`}
            >
              {sketchPreview ? (
                <img
                  src={sketchPreview}
                  alt="Uploaded sketch"
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="text-center">
                  <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-400">Click to upload sketch</p>
                </div>
              )}
            </div>
            <input
              id="sketchUpload"
              type="file"
              accept="image/*"
              onChange={handleSketchUpload}
              className="hidden"
            />
          </div>

          {/* Generated Image */}
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold mb-4">Generated Image</h2>
            <div className="aspect-square rounded-xl bg-gray-800 flex items-center justify-center">
              {isProcessing ? (
                <Loader2 className="w-12 h-12 text-purple-500 animate-spin" />
              ) : generatedImage ? (
                <img
                  src={generatedImage}
                  alt="Generated image"
                  className="w-full h-full object-contain rounded-xl"
                />
              ) : (
                <ImageIcon className="w-12 h-12 text-gray-400" />
              )}
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-900 text-white rounded-lg text-center">
            {error}
          </div>
        )}

        <div className="mt-8 flex justify-center">
          <button
            onClick={handleGenerate}
            disabled={!sketch || isProcessing}
            className={`px-8 py-4 rounded-xl font-semibold text-lg
              transition-all duration-300 transform hover:scale-105
              ${!sketch || isProcessing
                ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
              }`}
          >
            {isProcessing ? (
              <>
                <Loader2 className="animate-spin -ml-1 mr-3 h-5 w-5 inline" />
                Processing...
              </>
            ) : (
              'Generate Image'
            )}
          </button>
        </div>

        <div className="mt-8 flex justify-center">
          <button
            onClick={handleDownload}
            disabled={!sketch || isProcessing}
            className={`px-8 py-4 rounded-xl font-semibold text-lg
              transition-all duration-300 transform hover:scale-105
              ${!sketch || isProcessing
                ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-green-600 to-blue-600 text-white hover:shadow-lg hover:shadow-green-500/20'
              }`}
          >
            {isProcessing ? (
              <>
                <Loader2 className="animate-spin -ml-1 mr-3 h-5 w-5 inline" />
                Processing...
              </>
            ) : (
              'Download Image'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SketchToImagePage;