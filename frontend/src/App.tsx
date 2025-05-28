import { BrowserRouter, Routes, Route } from "react-router-dom";
import LoginPage from "./pages/auth/LoginPage";
import RegisterPage from "./pages/auth/RegisterPage";
import HomePage from "./pages/HomePage";
import CCTVAnalyzerPage from "./pages/cctv/CCTVAnalyzerPage";
import VideoAnalysisReport from "./pages/cctv/VideoAnalysisReport";
import LiveDetectionPage from "./pages/live/LiveDetectionPage";
import SketchToImagePage from "./pages/sketch/SketchToImagePage";
import RecordsPage from "./pages/records/RecordsPage";
import MyRecordsPage from "./pages/records/MyRecordsPage";
import OtherRecordsPage from "./pages/records/OtherRecordsPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Auth Routes */}
        <Route path="/" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Main Routes */}
        <Route path="/home" element={<HomePage />} />

        {/* CCTV Analysis Routes */}
        <Route path="/analyze" element={<CCTVAnalyzerPage />} />
        <Route path="/analyze/report" element={<VideoAnalysisReport />} />

        {/* Live Detection Routes */}
        <Route path="/live" element={<LiveDetectionPage />} />

        {/* Sketch to Image Routes */}
        <Route path="/sketch" element={<SketchToImagePage />} />

        {/* Records Routes */}
        <Route path="/records" element={<RecordsPage />} />
        <Route path="/records/my-records" element={<MyRecordsPage />} />
        <Route path="/records/other-records" element={<OtherRecordsPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
