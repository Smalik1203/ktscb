// Conservative YouTube branding reduction script
export const removeYouTubeBranding = `
  // Wait for the page to load before applying styles
  function applyYouTubeStyles() {
    try {
      const style = document.createElement('style');
      style.innerHTML = \`
        /* Minimal branding reduction - only hide non-essential elements */
        .ytp-watermark {
          opacity: 0.2 !important;
        }
        
        .ytp-branding {
          opacity: 0.2 !important;
        }
        
        /* Hide promotional overlays that might interfere */
        .ytp-show-cards-title {
          display: none !important;
        }
        
        .ytp-impression-link {
          display: none !important;
        }
        
        /* Ensure video player is responsive */
        .html5-video-player {
          width: 100% !important;
          height: 100% !important;
        }
        
        .html5-video-container {
          width: 100% !important;
          height: 100% !important;
        }
        
        /* Ensure controls are accessible */
        .ytp-chrome-controls {
          z-index: 1000 !important;
        }
      \`;
      
      if (document.head) {
        document.head.appendChild(style);
      } else {
        // If head doesn't exist yet, wait and try again
        setTimeout(applyYouTubeStyles, 100);
      }
    } catch (error) {
      // Silently fail - styling is non-critical
    }
  }
  
  // Apply styles when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyYouTubeStyles);
  } else {
    applyYouTubeStyles();
  }
`;
