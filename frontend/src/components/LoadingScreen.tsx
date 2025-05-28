import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { FaMagnifyingGlass } from "react-icons/fa6";

interface LoadingScreenProps {
  onComplete: () => void;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({ onComplete }) => {
  const [rotation, setRotation] = useState(0);
  const [rounds, setRounds] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setRotation((prev) => {
        const newRotation = prev + 5;
        if (newRotation >= 360) {
          setRounds((prevRounds) => {
            if (prevRounds + 1 >= 3) {
              clearInterval(interval);
              setTimeout(onComplete, 20); // Slight delay before completing
              return prevRounds;
            }
            return prevRounds + 1;
          });
          return 0;
        }
        return newRotation;
      });
    }, 16); // Approximately 60fps

    return () => clearInterval(interval);
  }, [onComplete]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-gray-900 flex items-center justify-center z-50"
    >
      <div className="relative">
        <motion.div
          style={{ rotate: rotation }}
          className="text-blue-500 text-4xl"
        >
          <FaMagnifyingGlass className="w-16 h-16" />
        </motion.div>
      </div>
    </motion.div>
  );
};

export default LoadingScreen;
