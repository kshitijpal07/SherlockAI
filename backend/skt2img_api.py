import torch
import cv2
import numpy as np
import base64
from io import BytesIO
from PIL import Image

# FastAPI Imports
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware # Required for web integration

# Diffusers Imports
from diffusers import StableDiffusionControlNetPipeline, ControlNetModel, UniPCMultistepScheduler

# --- Global Variables for Model ---
# These will be populated when the server starts up (lifespan event)
pipe = None
device = "cuda" if torch.cuda.is_available() else "cpu"
print(f"CUDA available: {torch.cuda.is_available()}")

# --- FastAPI App Setup ---
app = FastAPI(title="ControlNet Sketch-to-Image API")

# Add CORS to allow requests from your React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In a hackathon, "*" is fine. For production, list your React URL.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Base Prompts (Fixed for High Quality Output) ---
# These constant features ensure high quality and correct styling every time.
# The user's input will be prepended to these.
BASE_POSITIVE_PROMPT = "photo of a suspect, photorealistic, front face, neutral background, cinematic lighting, high detail, 8k"
BASE_NEGATIVE_PROMPT = "ugly, deformed, bad anatomy, disfigured, blurry, low resolution, painting, drawing, cartoon, noise"


# --- Request Body Schema ---
# The user now provides their custom features and negative elements directly.
class GenerationRequest(BaseModel):
    # Base64 string of the input sketch (e.g., 'data:image/png;base64,...')
    sketch_base64: str 
    # User's custom physical description (e.g., "young male, blue eyes, short dark hair")
    user_features: str 
    # User's specific negative commands (e.g., "mustache, stubble, glasses, scar")
    user_negative_prompts: str = ""
    num_inference_steps: int = 20
    guidance_scale: float = 9.0

# --- HELPER FUNCTIONS ---

def base64_to_image(base64_string: str) -> Image.Image:
    """Decodes a Base64 string to a PIL Image."""
    # Remove metadata prefix if present (e.g., "data:image/png;base64,")
    if "," in base64_string:
        base64_string = base64_string.split(",")[1]
    
    img_bytes = base64.b64decode(base64_string)
    return Image.open(BytesIO(img_bytes)).convert("RGB")


def image_to_base64(image: Image.Image) -> str:
    """Encodes a PIL Image to a Base64 string."""
    buffered = BytesIO()
    image.save(buffered, format="PNG")
    return base64.b64encode(buffered.getvalue()).decode("utf-8")


def preprocess_sketch(image: Image.Image) -> Image.Image:
    """Converts a PIL image to Canny edges and resizes it."""
    # Convert PIL Image to OpenCV format (BGR)
    img = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
    
    # Canny Edge Detection
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 50, 150)
    
    # Convert edges back to 3-channel RGB for ControlNet input
    edges = cv2.cvtColor(edges, cv2.COLOR_GRAY2RGB)
    pil_img = Image.fromarray(edges)
    
    # Resize for speed (crucial)
    if pil_img.size != (512, 512):
        pil_img = pil_img.resize((512, 512)) 
        
    return pil_img

# --- MODEL LOADING (Runs once when server starts) ---

@app.on_event("startup")
async def load_model():
    """Initializes the ControlNet pipeline and places it on GPU."""
    global pipe
    print("--- STARTING MODEL INITIALIZATION ---")
    try:
        # 1. Load ControlNet and SD base models
        controlnet = ControlNetModel.from_pretrained(
            "lllyasviel/control_v11p_sd15_scribble",
            torch_dtype=torch.float16
        )
        pipe = StableDiffusionControlNetPipeline.from_pretrained(
            "runwayml/stable-diffusion-v1-5",
            controlnet=controlnet,
            torch_dtype=torch.float16
        )

        # 2. Apply VRAM Optimizations
        pipe.scheduler = UniPCMultistepScheduler.from_config(pipe.scheduler.config)
        pipe.enable_xformers_memory_efficient_attention()
        # This moves modules to CPU/Disk when not in use
        pipe.enable_model_cpu_offload() 
        
        print(f"✅ Model loaded successfully on {device}!")

    except Exception as e:
        print(f"🚨 FATAL ERROR LOADING MODEL: {e}")
        # In a real app, you might raise an exception here to halt startup.
        raise HTTPException(status_code=500, detail="AI Model failed to initialize. Check GPU/VRAM.")

# --- API ENDPOINT ---

@app.post("/generate-image")
async def generate_image_endpoint(request: GenerationRequest):
    """Generates an image based on the sketch and prompt."""
    if pipe is None:
        raise HTTPException(status_code=503, detail="AI Model not yet initialized.")

    try:
        # --- 1. PROMPT CONSTRUCTION (New Logic) ---
        
        # Combine user's positive features with the fixed base quality features
        final_positive_prompt = f"{request.user_features}, {BASE_POSITIVE_PROMPT}"
        
        # Combine user's negative prompts with the fixed base quality suppressors
        final_negative_prompt = f"{request.user_negative_prompts}, {BASE_NEGATIVE_PROMPT}"
        
        print(f"DEBUG: Final Prompt: {final_positive_prompt[:70]}...")
        
        # 2. Decode the input sketch
        sketch_pil = base64_to_image(request.sketch_base64)
        
        # 3. Preprocess to Canny Edges
        control_image = preprocess_sketch(sketch_pil)
        
        # 4. Run Inference (The GPU-intensive part)
        with torch.no_grad():
            result = pipe(
                final_positive_prompt, # Use the constructed prompt
                image=control_image,
                negative_prompt=final_negative_prompt, # Use the constructed negative prompt
                num_inference_steps=request.num_inference_steps,
                guidance_scale=request.guidance_scale,
                generator=torch.Generator(device=device).manual_seed(42) # Fixed seed for consistency
            ).images[0]
        
        # 5. Encode the result back to Base64
        result_base64 = image_to_base64(result)
        
        return {"image_base64": result_base64}

    except Exception as e:
        print(f"🚨 Generation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Image generation error: {e}")

# --- RUNNING INSTRUCTIONS ---
# To run this server:
# 1. Save this code as ai_api.py
# 2. Ensure you have uvicorn[standard] installed: pip install uvicorn[standard] fastapi
# 3. Run from your terminal: uvicorn ai_api:app --reload --host 0.0.0.0 --port 8000