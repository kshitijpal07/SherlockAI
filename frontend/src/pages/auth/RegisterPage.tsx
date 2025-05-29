import React, { useState } from 'react';
import { Shield, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { collection, getDocs, query, where, addDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useNavigate } from 'react-router-dom';

const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const [thanaName, setThanaName] = useState('');
  const [thanaId, setThanaId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [thanaIdError, setThanaIdError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingId, setIsCheckingId] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const validateThanaId = async (id: string): Promise<boolean> => {
    if (!id) return false;
    try {
      const thanaRef = collection(db, 'police_stations');
      const q = query(thanaRef, where('thanaId', '==', id));
      const querySnapshot = await getDocs(q);
      return querySnapshot.empty;
    } catch (err) {
      console.error('Error validating thana ID:', err);
      return false;
    }
  };

  const handleThanaIdChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const id = e.target.value;
    setThanaId(id);
    setThanaIdError('');

    if (id.length >= 3) {
      setIsCheckingId(true);
      try {
        const isUnique = await validateThanaId(id);
        if (!isUnique) {
          setThanaIdError('This Thana ID already exists');
        }
      } catch (err) {
        console.error('Error checking ID:', err);
      } finally {
        setIsCheckingId(false);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      // Validation checks
      if (!thanaName || !thanaId || !password) {
        throw new Error('Please fill in all fields');
      }

      if (password.length < 6) {
        throw new Error('Password must be at least 6 characters long');
      }

      if (thanaIdError) {
        throw new Error('Please choose a unique Thana ID');
      }

      // Check ID uniqueness one last time
      const isUnique = await validateThanaId(thanaId);
      if (!isUnique) {
        throw new Error('This Thana ID already exists');
      }

      // Create the police station document
      const policeStationData = {
        thanaName,
        thanaId,
        password,
        createdAt: new Date().toISOString(),
        active: true // Add an active status
      };

      await addDoc(collection(db, 'police_stations'), policeStationData);

      setSuccess('Registration successful! Redirecting to login...');
      setThanaName('');
      setThanaId('');
      setPassword('');

      // Redirect to login after successful registration
      setTimeout(() => {
        navigate('/');
      }, 2000);
    } catch (err) {
      console.error('Registration error:', err);
      setError(err instanceof Error ? err.message : 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <Shield className="w-12 h-12 text-indigo-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-800">Admin Registration</h1>
          <p className="text-gray-600 mt-2">Register a new police station</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Police Station Name
            </label>
            <input
              type="text"
              value={thanaName}
              onChange={(e) => setThanaName(e.target.value)}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all ${error && !thanaName ? 'border-red-500' : 'border-gray-300'
                }`}
              placeholder="Enter police station name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Unique Thana ID
            </label>
            <div className="relative">
              <input
                type="text"
                value={thanaId}
                onChange={handleThanaIdChange}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all ${(error && !thanaId) || thanaIdError ? 'border-red-500' : 'border-gray-300'
                  }`}
                placeholder="Enter unique Thana ID"
              />
              {isCheckingId && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                  Checking...
                </span>
              )}
            </div>
            {thanaIdError && (
              <p className="mt-1 text-sm text-red-600">{thanaIdError}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all ${error && !password ? 'border-red-500' : 'border-gray-300'
                  }`}
                placeholder="Enter password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg animate-fade-in">
              <AlertCircle className="w-5 h-5" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 text-green-600 bg-green-50 p-3 rounded-lg animate-fade-in">
              <Shield className="w-5 h-5" />
              <span className="text-sm">{success}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || isCheckingId || !!thanaIdError}
            className={`w-full bg-indigo-600 text-white py-2 rounded-lg font-medium
              transition-all duration-300 hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-200
              ${(isLoading || isCheckingId || !!thanaIdError) ? 'opacity-75 cursor-not-allowed' : ''}`}
          >
            {isLoading ? 'Registering...' : 'Register Police Station'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default RegisterPage;