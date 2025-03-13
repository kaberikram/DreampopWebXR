# Dreampop

A WebXR color-matching game built for Meta Quest devices. Match the color of your projectiles with the spheres to score points against the clock!

## Features

- Color-matching gameplay mechanics
- 60-second time challenge
- Score tracking
- Dynamic sphere respawning
- Bonus time for successful hits
- WebXR passthrough AR support

## Technologies Used

- Three.js for 3D graphics
- WebXR for AR functionality
- Webpack for bundling
- GSAP for animations

## Getting Started

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
4. Open https://localhost:8081 in your Meta Quest Browser

## Controls

- Use the right controller trigger to shoot
- Use the right thumbstick to cycle through colors
- Match the projectile color with the sphere color to score

## Building for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

## Deployment

This project is configured for deployment on Vercel. Simply push to your repository and Vercel will automatically build and deploy your changes.

## Credits

Created by: Ikram Hakim  
Twitter: [@Kaberikram](https://x.com/Kaberikram)
