import express from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { promises as fs } from 'fs';
import path from 'path';
import { optimize } from 'svgo';

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(express.static('public'));

async function imageToSVG(buffer) {
  const image = sharp(buffer);
  const metadata = await image.metadata();
  
  // Process image to enhance colors without converting to grayscale
  const processedBuffer = await image
    .normalize()
    .modulate({
      saturation: 1.2,  // Increase color saturation
      brightness: 1.1   // Slightly increase brightness
    })
    .png()
    .toBuffer();

  // Convert PNG to data URL
  const base64Image = processedBuffer.toString('base64');
  
  // Create SVG with embedded image and preserve colors
  const svgContent = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${metadata.width}" height="${metadata.height}">
      <defs>
        <filter id="enhance">
          <feComponentTransfer>
            <feFuncR type="linear" slope="1.2" intercept="0"/>
            <feFuncG type="linear" slope="1.2" intercept="0"/>
            <feFuncB type="linear" slope="1.2" intercept="0"/>
          </feComponentTransfer>
        </filter>
      </defs>
      <image
        width="100%"
        height="100%"
        preserveAspectRatio="none"
        href="data:image/png;base64,${base64Image}"
        style="filter: url(#enhance);"
      />
    </svg>`;

  // Optimize SVG
  const result = optimize(svgContent, {
    plugins: [
      'preset-default',
      'removeDimensions',
      {
        name: 'removeViewBox',
        active: false
      }
    ]
  });

  return result.data;
}

app.post('/convert', upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded.');
  }

  try {
    // Read the uploaded file
    const imageBuffer = await fs.readFile(req.file.path);
    
    // Convert to SVG
    const svg = await imageToSVG(imageBuffer);

    // Delete the uploaded file
    await fs.unlink(req.file.path);

    // Send the SVG
    res.setHeader('Content-Type', 'image/svg+xml');
    res.send(svg);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Error processing image: ' + error.message);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
