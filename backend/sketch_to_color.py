import torch
import torch.nn as nn
import torch.optim as optim
import torchvision.transforms as transforms
import torchvision.datasets as datasets
import os
from torch.utils.data import DataLoader
from tqdm.auto import tqdm
import matplotlib.pyplot as plt
import random

# Function to denormalize images for proper visualization
def denormalize(tensor):
    return tensor * 0.5 + 0.5  # Reverse normalization

# Function to visualize only ONE image every 5 epochs
def visualize_image(input_img, generated_img, target_img):
    fig, axes = plt.subplots(1, 3, figsize=(12, 4))
    
    axes[0].imshow(denormalize(input_img).permute(1, 2, 0).cpu().detach().numpy())
    axes[0].set_title("Input Sketch")
    
    axes[1].imshow(denormalize(generated_img).permute(1, 2, 0).cpu().detach().numpy())
    axes[1].set_title("Generated Image")
    
    axes[2].imshow(denormalize(target_img).permute(1, 2, 0).cpu().detach().numpy())
    axes[2].set_title("Real Image")

    plt.show()

# Function to plot generator & discriminator losses
def plot_losses(generator_losses, discriminator_losses):
    plt.figure(figsize=(10, 5))
    plt.plot(generator_losses, label='Generator Loss')
    plt.plot(discriminator_losses, label='Discriminator Loss')
    plt.xlabel('Epochs')
    plt.ylabel('Loss')
    plt.legend()
    plt.title('Training Losses')
    plt.show()

# Downsampling Block
class DownSample(nn.Module):
    def __init__(self, in_channels, out_channels):
        super(DownSample, self).__init__()
        self.model = nn.Sequential(
            nn.Conv2d(in_channels, out_channels, 4, 2, 1, bias=False),
            nn.LeakyReLU(0.2, inplace=True)
        )
    def forward(self, x):
        return self.model(x)

# Upsampling Block
class Upsample(nn.Module):
    def __init__(self, in_channels, out_channels):
        super(Upsample, self).__init__()
        self.model = nn.Sequential(
            nn.ConvTranspose2d(in_channels, out_channels, 4, 2, 1, bias=False),
            nn.InstanceNorm2d(out_channels),
            nn.ReLU(inplace=True)
        )
    def forward(self, x, skip_input):
        x = self.model(x)
        x = torch.cat((x, skip_input), 1)
        return x

# Generator Model
class Generator(nn.Module):
    def __init__(self):
        super(Generator, self).__init__()
        self.down1 = DownSample(3, 64)
        self.down2 = DownSample(64, 128)
        self.down3 = DownSample(128, 256)
        self.down4 = DownSample(256, 512)
        self.down5 = DownSample(512, 512)
        self.down6 = DownSample(512, 512)
        self.down7 = DownSample(512, 512)
        self.down8 = DownSample(512, 512)
        self.up1 = Upsample(512, 512)
        self.up2 = Upsample(1024, 512)
        self.up3 = Upsample(1024, 512)
        self.up4 = Upsample(1024, 512)
        self.up5 = Upsample(1024, 256)
        self.up6 = Upsample(512, 128)
        self.up7 = Upsample(256, 64)
        self.final = nn.Sequential(
            nn.Upsample(scale_factor=2),
            nn.ZeroPad2d((1, 0, 1, 0)),
            nn.Conv2d(128, 3, 4, padding=1),
            nn.Tanh()
        )
    def forward(self, x):
        d1 = self.down1(x)
        d2 = self.down2(d1)
        d3 = self.down3(d2)
        d4 = self.down4(d3)
        d5 = self.down5(d4)
        d6 = self.down6(d5)
        d7 = self.down7(d6)
        d8 = self.down8(d7)
        u1 = self.up1(d8, d7)
        u2 = self.up2(u1, d6)
        u3 = self.up3(u2, d5)
        u4 = self.up4(u3, d4)
        u5 = self.up5(u4, d3)
        u6 = self.up6(u5, d2)
        u7 = self.up7(u6, d1)
        return self.final(u7)

# Discriminator Model
class Discriminator(nn.Module):
    def __init__(self):
        super(Discriminator, self).__init__()
        self.model = nn.Sequential(
            nn.Conv2d(6, 64, 4, 2, 1, bias=False),
            nn.LeakyReLU(0.2, inplace=True),
            nn.Conv2d(64, 128, 4, 2, 1, bias=False),
            nn.LeakyReLU(0.2, inplace=True),
            nn.Conv2d(128, 256, 4, 2, 1, bias=False),
            nn.LeakyReLU(0.2, inplace=True),
            nn.Conv2d(256, 512, 4, 2, 1, bias=False),
            nn.LeakyReLU(0.2, inplace=True),
            nn.ZeroPad2d((1, 0, 1, 0)),
            nn.Conv2d(512, 1, 4, padding=1, bias=False)
        )
    def forward(self, img_A, img_B):
        img_input = torch.cat((img_A, img_B), 1)
        return self.model(img_input)
    
# Dataset
data_dir = r"images\Paired_Images-perfect"
transform = transforms.Compose([
    transforms.Resize((256, 256)),
    transforms.ToTensor(),
    transforms.Normalize([0.5], [0.5])
])
dataset = datasets.ImageFolder(root=data_dir, transform=transform)
dataloader = DataLoader(dataset, batch_size=4, shuffle=True, num_workers=0)

# Training Setup
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
generator = Generator().to(device)
discriminator = Discriminator().to(device)

discriminator_opt = optim.Adam(discriminator.parameters(), lr=0.0001, betas=(0.5, 0.999))
generator_opt = optim.Adam(generator.parameters(), lr=0.0001, betas=(0.5, 0.999))

loss_comparison = nn.BCEWithLogitsLoss()
L1_loss = nn.L1Loss()
L1_lambda = 50

# Training Variables
NUM_EPOCHS = 30  # Max epochs, will stop earlier if satisfied
# SAVE_EVERY = 5
generator_losses = []
discriminator_losses = []
# current_epoch = 0
# model_filename = "generator_pix2pix_epochs.pth"  # Single file for weights

import torch
import torchvision.transforms as transforms
from PIL import Image
import matplotlib.pyplot as plt
import numpy as np

# Load trained model
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
generator = Generator().to(device)
generator.load_state_dict(torch.load(r"generator_pix2pix.pth", map_location=device))
generator.eval()

# Define transformations (Ensure it matches training)
transform = transforms.Compose([
    transforms.Resize((256, 256)),
    transforms.Grayscale(num_output_channels=3),  # Convert to 3-channel grayscale
    transforms.ToTensor(),
    transforms.Normalize([0.5], [0.5])  # Match training normalization
])

def denormalize(tensor):
    """ Convert from [-1, 1] to [0, 1] for display """
    tensor = tensor * 0.5 + 0.5
    tensor = tensor.clamp(0, 1)  # Ensure values are within range
    return tensor

def generate_image(sketch_path, output_path="images/colored/new_colored_output.jpg"):
    # Load and preprocess sketch image
    sketch = Image.open(sketch_path).convert("L")  # Convert to grayscale
    sketch = sketch.convert("RGB")  # Ensure 3-channel format
    sketch_tensor = transform(sketch).unsqueeze(0).to(device)  # Add batch dimension

    # Generate output
    with torch.no_grad():
        generated_image = generator(sketch_tensor).squeeze(0).cpu().detach()
    
    # Convert back to image format
    generated_image = denormalize(generated_image).permute(1, 2, 0).numpy()
    generated_image = (generated_image * 255).astype(np.uint8)  # Convert to 0-255 for saving

    # Display images
    fig, axes = plt.subplots(1, 2, figsize=(10, 5))

    # Input Sketch
    axes[0].imshow(sketch, cmap="gray")  # Ensure grayscale display
    axes[0].set_title("Input Sketch")
    axes[0].axis("off")

    # Generated Image
    axes[1].imshow(generated_image)
    axes[1].set_title("Generated Image")
    axes[1].axis("off")

    plt.show()

    # Save output
    Image.fromarray(generated_image).save(output_path)

# Test with an example sketch
# generate_image(r"images\srinjoy.png")