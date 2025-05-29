import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, CameraOff, FileSearch, Database } from "lucide-react";
import LoadingScreen from "../components/LoadingScreen";

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 100,
      },
    },
  };

  const buttons = [
    {
      title: "CCTV Footage Analyzer",
      icon: <Camera className="w-8 h-8" />,
      path: "/analyze",
      gradient: "from-purple-600 to-blue-600",
    },
    {
      title: "Live CCTV Detection",
      icon: <CameraOff className="w-8 h-8" />,
      path: "/live",
      gradient: "from-blue-600 to-cyan-600",
    },
    {
      title: "Sketch to Image",
      icon: <FileSearch className="w-8 h-8" />,
      path: "/sketch",
      gradient: "from-cyan-600 to-teal-600",
    },
    {
      title: "Records",
      icon: <Database className="w-8 h-8" />,
      path: "/records",
      gradient: "from-teal-600 to-green-600",
    },
  ];

  return (
    <>
      <AnimatePresence>
        {isLoading && <LoadingScreen onComplete={() => setIsLoading(false)} />}
      </AnimatePresence>

      <div className="min-h-screen bg-gray-900 text-white p-8">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={containerVariants}
          className="max-w-6xl mx-auto"
        >
          {/* Glowing Heading */}
          <motion.h1
            className="text-6xl font-bold text-center mb-16 relative"
            variants={itemVariants}
          >
            <span
              className="bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-purple-500 
              filter blur-sm absolute inset-0 animate-pulse"
            >
              AI Criminal Detection
            </span>
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-purple-500 relative">
              AI Criminal Detection
            </span>
          </motion.h1>

          {/* Navigation Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12">
            {buttons.map((button, index) => (
              <motion.div
                key={button.title}
                variants={itemVariants}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`bg-gradient-to-r ${button.gradient} p-0.5 rounded-2xl cursor-pointer
                  transform transition-all duration-300 hover:shadow-2xl hover:shadow-blue-500/20`}
              >
                <button
                  onClick={() => navigate(button.path)}
                  className="w-full h-full bg-gray-900 rounded-2xl p-8 transition-all duration-300
                    hover:bg-opacity-80 flex flex-col items-center justify-center gap-4"
                >
                  <div className="p-4 bg-gray-800 rounded-full">
                    {button.icon}
                  </div>
                  <h2 className="text-2xl font-semibold text-center">
                    {button.title}
                  </h2>
                </button>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </>
  );
};

export default HomePage;
