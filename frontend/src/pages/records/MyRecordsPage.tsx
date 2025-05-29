import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, RefreshCw, UserX, Search, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Suspect {
  id: string;
  name: string;
  crimeDetails: string;
  type: 'suspect' | 'surveillance';
}

const MyRecordsPage: React.FC = () => {
  const navigate = useNavigate();
  const [suspects, setSuspects] = useState<Suspect[]>([
    { id: '1', name: 'John Doe', crimeDetails: 'Theft', type: 'suspect' },
    { id: '2', name: 'Jane Smith', crimeDetails: 'Fraud', type: 'suspect' },
    { id: '3', name: 'Mike Johnson', crimeDetails: 'Assault', type: 'surveillance' },
    { id: '4', name: 'Sarah Wilson', crimeDetails: 'Cybercrime', type: 'surveillance' },
  ]);

  const [removedSuspects, setRemovedSuspects] = useState<Suspect[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  const handleRemove = (suspect: Suspect) => {
    setSuspects(suspects.filter(s => s.id !== suspect.id));
    setRemovedSuspects([...removedSuspects, suspect]);
  };

  const handleRestore = (suspect: Suspect) => {
    setRemovedSuspects(removedSuspects.filter(s => s.id !== suspect.id));
    setSuspects([...suspects, suspect]);
  };

  const filteredSuspects = suspects.filter(suspect =>
    suspect.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    suspect.crimeDetails.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredRemovedSuspects = removedSuspects.filter(suspect =>
    suspect.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    suspect.crimeDetails.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const SuspectCard: React.FC<{ suspect: Suspect; onAction: () => void; isRemoved?: boolean }> = 
    ({ suspect, onAction, isRemoved = false }) => (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="bg-gray-800 rounded-xl p-6 space-y-4"
    >
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-xl font-semibold text-white">{suspect.name}</h3>
          <p className="text-gray-400">{suspect.crimeDetails}</p>
          <span className={`inline-block mt-2 px-3 py-1 rounded-full text-sm
            ${suspect.type === 'suspect' ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'}`}>
            {suspect.type === 'suspect' ? 'Suspect' : 'Under Surveillance'}
          </span>
        </div>
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={onAction}
          className={`p-2 rounded-lg ${isRemoved ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}
        >
          {isRemoved ? <RefreshCw className="w-5 h-5" /> : <Trash2 className="w-5 h-5" />}
        </motion.button>
      </div>
    </motion.div>
  );

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex items-center gap-4">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/records')}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Records</span>
          </motion.button>
        </div>

        <div>
          <h1 className="text-4xl font-bold mb-2">My Records</h1>
          <p className="text-gray-400">Manage your station's criminal records</p>
        </div>

        <div className="relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search suspects by name or crime details..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-gray-800 rounded-xl text-white placeholder-gray-400
              border-2 border-gray-700 focus:border-blue-500 focus:outline-none transition-colors"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <motion.div layout className="space-y-6">
            <h2 className="text-2xl font-semibold">Active Records</h2>
            <AnimatePresence>
              {filteredSuspects.filter(s => s.type === 'suspect').map(suspect => (
                <SuspectCard
                  key={suspect.id}
                  suspect={suspect}
                  onAction={() => handleRemove(suspect)}
                />
              ))}
            </AnimatePresence>
          </motion.div>

          <motion.div layout className="space-y-6">
            <h2 className="text-2xl font-semibold">Live Surveillance</h2>
            <AnimatePresence>
              {filteredSuspects.filter(s => s.type === 'surveillance').map(suspect => (
                <SuspectCard
                  key={suspect.id}
                  suspect={suspect}
                  onAction={() => handleRemove(suspect)}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        </div>

        <motion.div layout className="mt-12">
          <div className="flex items-center gap-3 mb-6">
            <UserX className="w-6 h-6 text-gray-400" />
            <h2 className="text-2xl font-semibold">Removed Records</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence>
              {filteredRemovedSuspects.map(suspect => (
                <SuspectCard
                  key={suspect.id}
                  suspect={suspect}
                  onAction={() => handleRestore(suspect)}
                  isRemoved
                />
              ))}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default MyRecordsPage;