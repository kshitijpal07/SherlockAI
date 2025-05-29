import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2, AlertCircle, Loader2, RefreshCw } from 'lucide-react';

// API endpoint constants
const API_BASE_URL = 'http://localhost:8000';
const GET_FACES_ENDPOINT = `${API_BASE_URL}/get-faces`;
const DELETE_FACE_ENDPOINT = `${API_BASE_URL}/delete-face`;

interface FaceData {
  id: string;
  name: string;
  location: string;
  image_path: string;
  created_at: string;
}

const RecordsPage: React.FC = () => {
  const navigate = useNavigate();
  const [faces, setFaces] = useState<FaceData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<{[key: string]: boolean}>({});

  // Fetch faces from database
  const fetchFaces = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch(GET_FACES_ENDPOINT, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        mode: 'cors',
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.status === 'success') {
        setFaces(data.faces || []);
      } else {
        throw new Error(data.message || 'Failed to fetch faces');
      }
    } catch (err) {
      console.error("Error fetching faces:", err);
      setError(err instanceof Error ? err.message : 'Failed to fetch faces from database');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Delete face from database
  const deleteFace = async (faceId: string) => {
    try {
      setIsDeleting(prev => ({ ...prev, [faceId]: true }));
      
      const response = await fetch(`${DELETE_FACE_ENDPOINT}/${faceId}`, {
        method: 'DELETE',
        headers: {
          'Accept': 'application/json',
        },
        mode: 'cors',
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.status === 'success') {
        // Remove the deleted face from state
        setFaces(faces.filter(face => face.id !== faceId));
      } else {
        throw new Error(result.message || 'Failed to delete face');
      }
    } catch (err) {
      console.error("Error deleting face:", err);
      setError(err instanceof Error ? err.message : 'Failed to delete face');
    } finally {
      setIsDeleting(prev => {
        const newState = { ...prev };
        delete newState[faceId];
        return newState;
      });
    }
  };

  // Load faces on component mount
  useEffect(() => {
    fetchFaces();
  }, [fetchFaces]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 100
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <motion.div
        initial="hidden"
        animate="visible"
        variants={containerVariants}
        className="max-w-4xl mx-auto"
      >
        <motion.div
          variants={itemVariants}
          className="flex items-center justify-between gap-4 mb-12"
        >
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/home')}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Home</span>
          </motion.button>
          
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={fetchFaces}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <RefreshCw className="w-5 h-5" />
            )}
            <span>Refresh Data</span>
          </motion.button>
        </motion.div>

        <motion.div variants={itemVariants} className="mb-12 text-center">
          <h1 className="text-4xl font-bold mb-2">Face Records</h1>
          <p className="text-gray-400">View and manage face data in the database</p>
        </motion.div>

        {error && (
          <motion.div 
            variants={itemVariants}
            className="mb-8 flex items-center gap-2 text-red-500 bg-red-500/10 p-4 rounded-lg"
          >
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </motion.div>
        )}

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
            <p className="text-gray-400">Loading face records...</p>
          </div>
        ) : faces.length === 0 ? (
          <motion.div 
            variants={itemVariants}
            className="bg-gray-800 rounded-xl p-8 text-center"
          >
            <p className="text-xl text-gray-400 mb-2">No face records found</p>
            <p className="text-gray-500">Add suspects from the Live Detection page</p>
          </motion.div>
        ) : (
          <AnimatePresence>
            <motion.div 
              variants={itemVariants}
              className="grid grid-cols-1 gap-4"
            >
              {faces.map((face) => (
                <motion.div
                  key={face.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="bg-gray-800 rounded-xl overflow-hidden"
                >
                  <div className="flex flex-col md:flex-row">
                    {face.image_path && (
                      <div className="w-full md:w-48 h-48 bg-gray-700 flex-shrink-0">
                        <img 
                          src={face.image_path.startsWith('http') ? face.image_path : `${API_BASE_URL}/${face.image_path}`} 
                          alt={face.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://via.placeholder.com/200?text=No+Image';
                          }}
                        />
                      </div>
                    )}
                    
                    <div className="p-6 flex-1">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h2 className="text-2xl font-semibold mb-1">{face.name}</h2>
                          <p className="text-blue-400">{face.location}</p>
                          {face.created_at && (
                            <p className="text-gray-500 text-sm mt-2">
                              Added on {new Date(face.created_at).toLocaleDateString()} at {new Date(face.created_at).toLocaleTimeString()}
                            </p>
                          )}
                        </div>
                        
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => deleteFace(face.id)}
                          disabled={isDeleting[face.id]}
                          className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg transition-colors"
                        >
                          {isDeleting[face.id] ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                          ) : (
                            <Trash2 className="w-5 h-5" />
                          )}
                        </motion.button>
                      </div>
                      
                      <div className="pt-2 border-t border-gray-700">
                        <h3 className="text-sm font-medium text-gray-400 mb-2">Record ID</h3>
                        <p className="font-mono text-xs text-gray-500 break-all">{face.id}</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </AnimatePresence>
        )}
      </motion.div>
    </div>
  );
};

export default RecordsPage;