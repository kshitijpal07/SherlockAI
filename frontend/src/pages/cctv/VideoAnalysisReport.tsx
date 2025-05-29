import React from "react";
import { motion } from "framer-motion";
import {
  Download,
  ArrowLeft,
  Calendar,
  Shield,
  Clock,
  UserX,
} from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { format } from "date-fns";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  PDFViewer,
  pdf,
  Image,
} from "@react-pdf/renderer";

interface Appearance {
  imageUrl: string;
  timestamp: string;
}

interface Suspect {
  id: string;
  name: string;
  crimeDetails: string;
  type: "suspect" | "surveillance";
  imageUrl?: string;
  confidence?: number;
  timestamp?: string;
  location?: string;
  appearances?: Appearance[];
}

interface VideoReport {
  videoName: string;
  videoLength: string;
  framesProcessed: number;
  processingTime: string;
  totalSuspects: number;
  suspects: Suspect[];
  policeStation: string;
  analyzedDate: Date;
  screenshotUrl?: string;
}

// Function to convert CCTVAnalyzerPage results to VideoReport format
export const convertAnalysisToReport = (
  results: {
    suspectName: string;
    timestamp: string;
    screenshot: string;
  }[],
  stats: {
    framesProcessed: number;
    matchesFound: number;
  },
  processingTime: number,
  videoName: string
): VideoReport => {
  // Group results by suspect name
  const groupedResults = Object.entries(
    results.reduce((acc, result) => {
      if (!acc[result.suspectName]) {
        acc[result.suspectName] = [];
      }
      acc[result.suspectName].push(result);
      return acc;
    }, {} as Record<string, typeof results>)
  );

  // Create suspects array
  const suspects = groupedResults.map(
    ([suspectName, suspectResults], index) => {
      const appearances = suspectResults.map((result) => ({
        imageUrl: result.screenshot,
        timestamp: result.timestamp,
      }));

      return {
        id: `s${index + 1}`,
        name: suspectName,
        crimeDetails:
          suspectName === "Unknown"
            ? "Suspicious Activity"
            : "Potential Person of Interest",
        type:
          suspectName === "Unknown"
            ? "surveillance"
            : ("suspect" as "suspect" | "surveillance"),
        timestamp: appearances[0]?.timestamp,
        location: "Video Frame",
        appearances,
      };
    }
  );

  return {
    videoName: videoName || "Unnamed Video",
    videoLength: "Unknown",
    framesProcessed: stats.framesProcessed,
    processingTime: formatProcessingTime(processingTime),
    totalSuspects: stats.matchesFound,
    suspects,
    policeStation: "Kharghar Police Station",
    analyzedDate: new Date(),
    screenshotUrl: results[0]?.screenshot,
  };
};

// Helper to format processing time
const formatProcessingTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs
    .toString()
    .padStart(2, "0")}`;
};

// Create styles for PDF
const styles = StyleSheet.create({
  page: {
    flexDirection: "column",
    backgroundColor: "#ffffff",
    padding: 30,
  },
  section: {
    margin: 10,
    padding: 10,
    flexGrow: 1,
  },
  title: {
    fontSize: 24,
    textAlign: "center",
    marginBottom: 20,
    fontWeight: "bold",
  },
  header: {
    fontSize: 18,
    marginBottom: 10,
    fontWeight: "bold",
  },
  subheader: {
    fontSize: 16,
    marginTop: 10,
    marginBottom: 12,
    fontWeight: "bold",
    borderBottom: "1pt solid #eee",
    paddingBottom: 5,
  },
  text: {
    fontSize: 12,
    marginBottom: 5,
  },
  image: {
    width: 120,
    height: 120,
    objectFit: "cover",
  },
  screenshotImage: {
    width: "100%",
    height: 180,
    marginBottom: 15,
    objectFit: "contain",
  },
  suspectRow: {
    flexDirection: "row",
    marginBottom: 15,
    borderBottom: "1pt solid #ccc",
    paddingBottom: 10,
  },
  suspectInfo: {
    marginLeft: 10,
    flex: 1,
  },
  appearancesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 10,
    marginBottom: 10,
    gap: 5,
  },
  appearanceItem: {
    width: "48%",
    marginBottom: 10,
  },
  timestampText: {
    fontSize: 10,
    textAlign: "center",
    marginTop: 5,
  },
  pageNumber: {
    position: "absolute",
    bottom: 20,
    right: 20,
    fontSize: 10,
    color: "#666"
  }
});

// PDF Document Component
const PDFDocument: React.FC<{ data: VideoReport }> = ({ data }) => {
  // Helper function to chunk appearances into groups of 4 for pagination
  const chunkAppearances = (appearances: Appearance[]) => {
    const chunks: Appearance[][] = [];
    for (let i = 0; i < appearances.length; i += 4) {
      chunks.push(appearances.slice(i, i + 4));
    }
    return chunks;
  };

  return (
    <Document>
      {/* First page with summary */}
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.section}>
          <Text style={styles.title}>Video Analysis Report</Text>

          <Text style={styles.header}>Analysis Summary</Text>
          <Text style={styles.text}>Video Name: {data.videoName}</Text>
          <Text style={styles.text}>
            Total Frames Processed: {data.framesProcessed}
          </Text>
          <Text style={styles.text}>Processing Time: {data.processingTime}</Text>
          <Text style={styles.text}>
            Total Suspects Detected: {data.totalSuspects}
          </Text>
          <Text style={styles.text}>
            Police Station: {data.policeStation}
          </Text>
          <Text style={styles.text}>
            Date: {format(data.analyzedDate, "dd/MM/yyyy")}
          </Text>

          <Text style={{ ...styles.header, marginTop: 20 }}>
            Suspects Detected
          </Text>

          {/* Brief list of suspects on first page */}
          {data.suspects.map((suspect, idx) => (
            <Text key={idx} style={styles.text}>
              {idx + 1}. {suspect.name} - {suspect.crimeDetails}
            </Text>
          ))}
        </View>
        <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => (
          `${pageNumber} / ${totalPages}`
        )} fixed />
      </Page>

      {/* Create separate pages for each suspect */}
      {data.suspects.map((suspect, index) => {
        // Get appearances chunks if they exist
        const appearanceChunks = suspect.appearances
          ? chunkAppearances(suspect.appearances)
          : [];

        return (
          <React.Fragment key={index}>
            {/* First page for suspect with info */}
            <Page size="A4" style={styles.page} wrap>
              <View style={styles.section}>
                <Text style={styles.subheader}>
                  Suspect {index + 1}: {suspect.name}
                </Text>

                <View style={styles.suspectRow}>
                  {suspect.imageUrl && (
                    <Image src={suspect.imageUrl} style={styles.image} />
                  )}
                  <View style={styles.suspectInfo}>
                    <Text style={styles.text}>
                      Name: {suspect.name || "Unknown"}
                    </Text>
                    <Text style={styles.text}>
                      Crime Details: {suspect.crimeDetails || "N/A"}
                    </Text>
                    <Text style={styles.text}>
                      Timestamp: {suspect.timestamp || "N/A"}
                    </Text>
                    <Text style={styles.text}>
                      Location: {suspect.location || "N/A"}
                    </Text>
                    <Text style={styles.text}>
                      Type: {suspect.type}
                    </Text>
                    {suspect.confidence && (
                      <Text style={styles.text}>
                        Confidence: {suspect.confidence}%
                      </Text>
                    )}
                  </View>
                </View>

                {appearanceChunks.length > 0 && (
                  <>
                    <Text style={styles.subheader}>
                      Appearances ({suspect.appearances?.length || 0})
                    </Text>
                    {/* Show first chunk on the first page */}
                    <View style={styles.appearancesRow}>
                      {appearanceChunks[0].map((appearance, idx) => (
                        <View key={idx} style={styles.appearanceItem}>
                          <Image
                            src={appearance.imageUrl}
                            style={{ width: "100%", height: 200 }}
                          />
                          <Text style={styles.timestampText}>
                            Timestamp: {appearance.timestamp}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </>
                )}
              </View>
              <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => (
                `${pageNumber} / ${totalPages}`
              )} fixed />
            </Page>

            {/* Additional pages for remaining appearance chunks */}
            {appearanceChunks.length > 1 &&
              appearanceChunks.slice(1).map((chunk, chunkIndex) => (
                <Page key={`suspect-${index}-chunk-${chunkIndex}`} size="A4" style={styles.page} wrap>
                  <View style={styles.section}>
                    <Text style={styles.subheader}>
                      {suspect.name} - Additional Appearances
                    </Text>
                    <View style={styles.appearancesRow}>
                      {chunk.map((appearance, idx) => (
                        <View key={idx} style={styles.appearanceItem}>
                          <Image
                            src={appearance.imageUrl}
                            style={{ width: "100%", height: 120 }}
                          />
                          <Text style={styles.timestampText}>
                            Timestamp: {appearance.timestamp}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                  <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => (
                    `${pageNumber} / ${totalPages}`
                  )} fixed />
                </Page>
              ))
            }
          </React.Fragment>
        );
      })}
    </Document>
  );
};

const VideoAnalysisReport: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Check if report data was passed via location state
  const passedReportData = location.state?.reportData as
    | VideoReport
    | undefined;

  // Mock data for demonstration (use this if no data is passed)
  const defaultReportData: VideoReport = {
    videoName: "Traffic Camera A-12.mp4",
    videoLength: "02:15:36",
    framesProcessed: 194832,
    processingTime: "00:43:12",
    totalSuspects: 3,
    suspects: [
      {
        id: "s1",
        name: "John Doe",
        crimeDetails: "Theft",
        type: "suspect",
        confidence: 92.5,
        timestamp: "00:23:45",
        location: "Entrance",
        appearances: [
          {
            imageUrl:
              "https://images.unsplash.com/photo-1551361564-cde5056d68dd?ixlib=rb-4.0.3&auto=format&fit=crop&w=1350&q=80",
            timestamp: "00:01:23",
          },
          {
            imageUrl:
              "https://images.unsplash.com/photo-1570912355026-d860de74b5a9?ixlib=rb-4.0.3&auto=format&fit=crop&w=1350&q=80",
            timestamp: "00:02:45",
          },
        ],
      },
      {
        id: "s2",
        name: "Unknown",
        crimeDetails: "Suspicious Activity",
        type: "surveillance",
        confidence: 78.3,
        timestamp: "01:12:33",
        location: "Parking Lot",
        appearances: [
          {
            imageUrl:
              "https://images.unsplash.com/photo-1584438784894-089d6a62b8fa?ixlib=rb-4.0.3&auto=format&fit=crop&w=1350&q=80",
            timestamp: "01:12:33",
          },
          {
            imageUrl:
              "https://images.unsplash.com/photo-1557690756-2843ad5fda89?ixlib=rb-4.0.3&auto=format&fit=crop&w=1350&q=80",
            timestamp: "01:15:12",
          },
        ],
      },
      {
        id: "s3",
        name: "Jane Smith",
        crimeDetails: "Fraud",
        type: "suspect",
        confidence: 89.1,
        timestamp: "01:45:26",
        location: "ATM",
        appearances: [
          {
            imageUrl:
              "https://images.unsplash.com/photo-1495368370424-517755106b12?ixlib=rb-4.0.3&auto=format&fit=crop&w=1350&q=80",
            timestamp: "01:45:26",
          },
          {
            imageUrl:
              "https://images.unsplash.com/photo-1542567455-cd733f23fbb1?ixlib=rb-4.0.3&auto=format&fit=crop&w=1350&q=80",
            timestamp: "01:48:05",
          },
        ],
      },
    ],
    policeStation: "Central Police Station",
    analyzedDate: new Date(),
    screenshotUrl:
      "https://images.unsplash.com/photo-1561573746-126014240d5e?ixlib=rb-4.0.3&auto=format&fit=crop&w=1350&q=80",
  };

  // Use passed data or fall back to mock data
  const reportData = passedReportData || defaultReportData;

  const handleDownloadPDF = async () => {
    try {
      // Create a loading indicator
      const loadingElement = document.createElement("div");
      loadingElement.classList.add(
        "fixed",
        "inset-0",
        "flex",
        "items-center",
        "justify-center",
        "bg-black",
        "bg-opacity-50",
        "z-50"
      );
      loadingElement.innerHTML = `
        <div class="bg-blue-800 p-4 rounded-lg shadow-lg flex items-center gap-3">
          <svg class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span class="text-white">Generating PDF...</span>
        </div>
      `;
      document.body.appendChild(loadingElement);

      // Generate the PDF
      const blob = await pdf(<PDFDocument data={reportData} />).toBlob();

      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `analysis-report-${format(new Date(), "yyyy-MM-dd")}.pdf`;
      document.body.appendChild(link);
      link.click();

      // Clean up
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        document.body.removeChild(loadingElement);
      }, 100);
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert("Failed to generate PDF report. Please try again.");
    }
  };

  return (
    <motion.div
      className="min-h-screen bg-gradient-to-b from-blue-900 to-blue-950 text-white p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <button
            onClick={() => navigate("/analyze")}
            className="flex items-center gap-2 text-blue-300 hover:text-white transition-colors"
          >
            <ArrowLeft size={18} />
            Back
          </button>

          <button
            onClick={handleDownloadPDF}
            className="flex items-center gap-2 bg-blue-700 hover:bg-blue-600 px-4 py-2 rounded-md transition-colors"
          >
            <Download size={18} />
            Download PDF
          </button>
        </div>

        {/* Report Content */}
        <div className="bg-blue-800 rounded-xl p-6 shadow-2xl mb-8">
          <h1 className="text-3xl font-bold mb-6 border-b border-blue-600 pb-4">
            Video Analysis Report
          </h1>

          <div className="grid md:grid-cols-2 gap-8 mb-8">
            <div>
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Shield /> Analysis Summary
              </h2>
              <div className="space-y-3">
                <p>
                  <span className="text-blue-300">Frames Processed:</span>{" "}
                  {reportData.framesProcessed.toLocaleString()}
                </p>
                <p>
                  <span className="text-blue-300">Processing Time:</span>{" "}
                  {reportData.processingTime}
                </p>
                <p>
                  <span className="text-blue-300">Suspects Detected:</span>{" "}
                  {reportData.totalSuspects}
                </p>
              </div>
            </div>
          </div>

          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Calendar /> Suspects Detected
          </h2>

          <div className="space-y-4">
            {reportData.suspects.map((suspect) => (
              <motion.div
                key={suspect.id}
                className="bg-blue-700 rounded-lg p-4"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <div className="grid md:grid-cols-2 gap-4 mb-4">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center">
                      <UserX size={32} />
                    </div>
                    <div>
                      <h3 className="font-semibold">{suspect.name}</h3>
                      <p className="text-blue-300">{suspect.crimeDetails}</p>
                      <div className="mt-2">
                        <span className="bg-blue-900 text-xs rounded-full px-2 py-1">
                          {suspect.type}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-blue-300">Timestamp:</span>
                      <span className="flex items-center gap-1">
                        <Clock size={14} /> {suspect.timestamp}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-blue-300">Location:</span>
                      <span>{suspect.location}</span>
                    </div>
                  </div>
                </div>

                {suspect.appearances && suspect.appearances.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-blue-600">
                    <h4 className="text-md font-semibold mb-3">
                      {suspect.appearances.length} appearances detected
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {suspect.appearances.map((appearance, idx) => (
                        <div
                          key={idx}
                          className="bg-blue-800 rounded-md overflow-hidden"
                        >
                          <img
                            src={appearance.imageUrl}
                            alt={`Appearance at ${appearance.timestamp}`}
                            className="w-full aspect-video object-cover"
                            style={{ width: "100%", height: 200 }}
                          />
                          <div className="px-2 py-1 text-center">
                            <p className="text-xs text-blue-300">
                              Timestamp: {appearance.timestamp}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>

        {/* PDF Viewer Preview */}
        <div className="bg-white rounded-xl overflow-hidden h-[500px] shadow-2xl">
          <PDFViewer style={{ width: "100%", height: "100%" }}>
            <PDFDocument data={reportData} />
          </PDFViewer>
        </div>
      </div>
    </motion.div>
  );
};

export default VideoAnalysisReport;
