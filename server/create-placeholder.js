const { createCanvas } = require("canvas");
const fs = require("fs");
const path = require("path");

// Function to create a placeholder image
const createPlaceholderImage = (productName, outputFilename) => {
  // Create a 400x300 placeholder image
  const width = 400;
  const height = 300;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // Choose a background color based on product name (for variety)
  const colors = {
    milk: "#e0f2fe", // light blue
    bread: "#f7e8d0", // light brown
    eggs: "#fff9c4", // light yellow
    cheese: "#fff59d", // yellow
    apples: "#f8bbd0", // pink
    rice: "#f5f5f5", // white
    cereal: "#ffe0b2", // orange
    coffee: "#d7ccc8", // brown
    default: "#cccccc", // gray
  };

  // Get the color or use default
  const productNameLower = productName.toLowerCase();
  const bgColor = colors[productNameLower] || colors.default;

  // Fill background
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, width, height);

  // Add a simple shape in the middle
  ctx.beginPath();
  ctx.arc(width / 2, height / 2 - 30, 60, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.strokeStyle = "#333333";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Add text
  ctx.font = "bold 40px sans-serif";
  ctx.fillStyle = "#333333";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(productName, width / 2, height / 2 + 70);

  // Save the image
  const buffer = canvas.toBuffer("image/jpeg");
  const outputPath = path.join(__dirname, "public", "images", outputFilename);

  fs.writeFileSync(outputPath, buffer);
  console.log(`Created placeholder image for ${productName} at ${outputPath}`);

  return outputPath;
};

// Create placeholder image for each product
const products = [
  { name: "Milk", filename: "milk.jpg" },
  { name: "Bread", filename: "bread.jpg" },
  { name: "Eggs", filename: "eggs.jpg" },
  { name: "Cheese", filename: "cheese.jpg" },
  { name: "Apples", filename: "apples.jpg" },
  { name: "Rice", filename: "rice.jpg" },
  { name: "Cereal", filename: "cereal.jpg" },
  { name: "Coffee", filename: "coffee.jpg" },
];

// Create a standard placeholder image
createPlaceholderImage("No Image", "product-placeholder.jpg");

// Create a placeholder for each product
products.forEach((product) => {
  createPlaceholderImage(product.name, product.filename);
});
