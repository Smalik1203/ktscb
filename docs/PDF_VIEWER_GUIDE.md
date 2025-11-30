# Production-Ready PDF Viewer Documentation

## Overview

This PDF viewer is built using `react-native-pdf` with automatic caching for offline access. It provides a native PDF viewing experience with full zoom, navigation, and error handling.

## Features

### ✅ Core Features
- **Native PDF Rendering** - Uses platform-native PDF renderers (PDFKit on iOS, PdfRenderer on Android)
- **Automatic Caching** - Downloads PDF once, then opens instantly from cache
- **Offline Access** - View PDFs without internet after first download
- **Pinch-to-Zoom** - Native zoom gestures (1x to 3x)
- **Page Navigation** - Swipe between pages or use arrow buttons
- **Loading States** - Shows progress while loading
- **Error Handling** - Graceful error messages with retry option
- **TypeScript** - Fully typed for type safety

### 🎨 UI Components
- **Header** - Shows PDF title and current page
- **Page Counter** - "Page X of Y" display
- **Navigation Controls** - Previous/Next page buttons
- **Zoom Controls** - Zoom in/out with percentage display
- **Loading Indicator** - Spinner with descriptive text
- **Error Screen** - Helpful error messages and retry button

## Installation

The PDF viewer is already configured in your project. If you need to set it up again:

```bash
npm install react-native-pdf react-native-blob-util
```

## Usage

### Basic Usage

```tsx
import { PDFViewer } from '../components/resources/PDFViewer';

// In your component
const [showPDF, setShowPDF] = useState(false);
const [pdfUrl, setPdfUrl] = useState('');

<Modal visible={showPDF}>
  <PDFViewer
    uri={pdfUrl}
    title="My PDF Document"
    onClose={() => setShowPDF(false)}
  />
</Modal>
```

### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `uri` | `string` | Yes | Remote URL of the PDF file |
| `title` | `string` | Yes | Title displayed in header |
| `onClose` | `() => void` | Yes | Callback when close button is pressed |

### Example with Supabase

```tsx
// Get PDF URL from Supabase Storage
const { data } = supabase.storage
  .from('resources')
  .getPublicUrl('path/to/file.pdf');

<PDFViewer
  uri={data.publicUrl}
  title={resource.title}
  onClose={handleClose}
/>
```

## How Caching Works

### Cache Mechanism

1. **First Open**
   - PDF downloads from remote URL
   - Saved to device cache directory
   - Subsequent opens load from cache (instant)

2. **Cache Location**
   - **iOS**: `Library/Caches/`
   - **Android**: `/data/data/com.yourapp/cache/`

3. **Cache Management**
   - OS automatically clears cache when storage is low
   - Cache persists across app restarts
   - No manual cache clearing needed

### Cache Configuration

```tsx
const pdfSource = {
  uri: 'https://example.com/file.pdf',
  cache: true,  // Enable caching
};
```

## Controls

### Page Navigation
- **Swipe Vertically** - Navigate between pages
- **Previous Button** - Go to previous page
- **Next Button** - Go to next page
- **Page Counter** - Shows "X / Y" format

### Zoom
- **Pinch Gesture** - Zoom in/out naturally
- **Zoom In Button** - Increase zoom by 50%
- **Zoom Out Button** - Decrease zoom by 50%
- **Zoom Range** - 1.0x (100%) to 3.0x (300%)
- **Zoom Display** - Shows current zoom percentage

## Error Handling

### Error States

The viewer handles these error scenarios:

1. **Network Errors**
   - No internet connection
   - Server not responding
   - Timeout errors

2. **File Errors**
   - Invalid PDF URL
   - Corrupted PDF file
   - Unsupported PDF format

3. **Permission Errors**
   - Storage access denied
   - File read errors

### Error UI

```
📄
Failed to load PDF
Error message here

• Check your internet connection
• Verify the PDF URL is valid
• Try closing and reopening

[Retry Button]
```

### Custom Error Handling

```tsx
const handleError = (error: any) => {
  console.error('PDF Error:', error);
  // Add custom error tracking
  analytics.trackError('pdf_load_failed', {
    url: uri,
    error: error.message,
  });
};
```

## Performance

### Optimization Features

1. **Lazy Loading** - Only renders visible pages
2. **Memory Management** - Automatically releases unused pages
3. **Hardware Acceleration** - Uses GPU for rendering (iOS)
4. **Progressive Rendering** - Shows pages as they load

### Large PDF Handling

The viewer can handle:
- ✅ PDFs with 1000+ pages
- ✅ File sizes up to 500MB
- ✅ High-resolution images
- ✅ Complex vector graphics

### Performance Tips

```tsx
// For very large PDFs, consider showing page count
{totalPages > 100 && (
  <Text>⚠️ Large document ({totalPages} pages)</Text>
)}

// Monitor load progress
const handleLoadProgress = (percent: number) => {
  console.log(`Loading: ${Math.round(percent * 100)}%`);
  // Update progress bar if needed
};
```

## Platform-Specific Behavior

### iOS
- Uses PDFKit (Apple's native PDF framework)
- Supports anti-aliasing for smooth rendering
- Better memory management

### Android
- Uses PdfRenderer (Android native)
- Hardware layer for better performance
- Handles large files efficiently

## Troubleshooting

### PDF Not Loading

**Problem**: PDF shows loading forever

**Solutions**:
1. Check URL is publicly accessible
2. Verify internet connection
3. Test URL in browser
4. Check for CORS issues

```bash
# Test URL
curl -I https://your-pdf-url.pdf
```

### Cache Not Working

**Problem**: PDF downloads every time

**Solutions**:
1. Verify `cache: true` is set
2. Check device storage space
3. Ensure file permissions are correct

```tsx
// Debug cache
console.log('PDF cached at:', filePath);
```

### Out of Memory Errors

**Problem**: App crashes with large PDFs

**Solutions**:
1. Reduce `maxScale` to limit zoom
2. Enable `enablePaging` for better memory management
3. Use `fitPolicy` to optimize rendering

```tsx
<Pdf
  maxScale={2.0}  // Reduce from 3.0
  enablePaging={true}
  fitPolicy={0}  // Fit to width
/>
```

### Blank Pages

**Problem**: Pages show as blank

**Solutions**:
1. Check PDF is not password-protected
2. Verify PDF format (some PDFs use non-standard features)
3. Try with different PDF

## Advanced Usage

### Custom Loading Indicator

```tsx
renderActivityIndicator={() => (
  <View>
    <ActivityIndicator size="large" color="#007AFF" />
    <Text>Loading page {currentPage}...</Text>
  </View>
)}
```

### Page Change Tracking

```tsx
const handlePageChanged = (page: number, total: number) => {
  console.log(`User on page ${page} of ${total}`);

  // Track analytics
  analytics.track('pdf_page_view', {
    page,
    total,
    title: pdfTitle,
  });
};
```

### Link Handling

```tsx
const handlePressLink = (uri: string) => {
  // Custom link handling
  if (uri.startsWith('http')) {
    Linking.openURL(uri);
  }
};
```

## Build Configuration

### Required for EAS Build

After adding the plugin, rebuild your app:

```bash
# Create new build
eas build --platform all --profile development

# Or for production
eas build --platform all --profile production
```

### Local Development Build

```bash
# iOS
npx expo run:ios

# Android
npx expo run:android
```

## API Reference

### Component Props

```typescript
interface PDFViewerProps {
  uri: string;           // PDF URL
  title: string;         // Display title
  onClose: () => void;   // Close handler
}
```

### State Management

```typescript
// Internal state (read-only)
const [currentPage, setCurrentPage] = useState(1);
const [totalPages, setTotalPages] = useState(0);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);
const [scale, setScale] = useState(1.0);
```

### Event Callbacks

```typescript
onLoadComplete: (numberOfPages: number, filePath: string) => void
onPageChanged: (page: number, numberOfPages: number) => void
onError: (error: Error) => void
onLoadProgress: (percent: number) => void
onPressLink: (uri: string) => void
```

## Testing

### Test Cases

1. **Load Test** - Verify PDF loads correctly
2. **Cache Test** - Confirm offline access works
3. **Navigation Test** - Test page navigation
4. **Zoom Test** - Verify zoom controls
5. **Error Test** - Test error handling with invalid URL

### Example Test

```typescript
describe('PDFViewer', () => {
  it('loads PDF successfully', async () => {
    const { getByText } = render(
      <PDFViewer
        uri="https://example.com/test.pdf"
        title="Test PDF"
        onClose={() => {}}
      />
    );

    await waitFor(() => {
      expect(getByText(/Page 1 of/)).toBeTruthy();
    });
  });
});
```

## Support

### Dependencies
- `react-native-pdf`: ^7.0.3
- `react-native-blob-util`: ^0.22.2

### Compatibility
- Expo SDK: 54+
- React Native: 0.81+
- iOS: 12.0+
- Android: API 21+ (5.0 Lollipop)

### Known Limitations
1. Does not support password-protected PDFs
2. Annotation editing not supported (read-only)
3. Form filling not supported
4. Some complex PDF features may not render

### Further Reading
- [react-native-pdf Documentation](https://github.com/wonday/react-native-pdf)
- [Expo File System](https://docs.expo.dev/versions/latest/sdk/filesystem/)
- [PDF Specification](https://www.adobe.com/devnet/pdf/pdf_reference.html)
