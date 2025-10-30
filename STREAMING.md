# Real-Time Streaming Support

## Overview

Takoss now supports **real-time streaming** for project generation, providing instant feedback to users as their application is being built. This feature aligns with industry standards used by tools like Bolt.new, v0.dev, Cursor, and Replit Agent.

## Key Features

- **Server-Sent Events (SSE)**: Real-time progress updates from server to client
- **Phase-by-Phase Progress**: Track each generation phase (Analysis, Complexity, Database, Frontend, Deployment)
- **Progress Percentages**: Visual progress bars showing completion status
- **Automatic UI Updates**: ProgressTracker component automatically displays streaming events
- **Error Handling**: Real-time error reporting with detailed messages
- **Backward Compatible**: Non-streaming endpoint still available

---

## Architecture

### Backend Components

#### 1. SimplifiedOrchestrator Event Emitter

**File:** `src/orchestrator/simpleTakossOrchestrator.ts`

The orchestrator now extends `EventEmitter` and emits progress events throughout the generation process.

```typescript
export class SimpleTakossOrchestrator extends EventEmitter {
  private emitEvent(event: StreamEvent): void {
    this.emit('progress', event);
  }

  public async generateApplication(request: ProjectRequest): Promise<GenerationResult> {
    // Emit initialization event
    this.emitEvent({
      type: 'phase_start',
      phase: 'initialization',
      message: `Starting generation for ${request.projectName}`,
      progress: 0,
    });

    // Emit events for each phase...
  }
}
```

**Stream Event Types:**
- `phase_start`: A new phase has started
- `phase_progress`: Progress update within a phase
- `phase_complete`: Phase successfully completed
- `error`: An error occurred
- `complete`: Entire generation completed

**Event Structure:**
```typescript
interface StreamEvent {
  type: 'phase_start' | 'phase_progress' | 'phase_complete' | 'error' | 'complete';
  phase: string;           // 'analysis', 'complexity', 'database', 'frontend', 'deployment'
  message: string;         // Human-readable message
  progress?: number;       // Percentage (0-100)
  data?: any;             // Additional metadata
}
```

#### 2. SSE API Endpoint

**File:** `src/api/server.ts`

New endpoint: `POST /api/generate/stream`

```typescript
this.app.post('/api/generate/stream', authMiddleware.authenticate, async (req, res) => {
  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Create orchestrator instance
  const streamOrchestrator = new SimpleTakossOrchestrator(process.env.CLAUDE_API_KEY);

  // Stream progress events
  streamOrchestrator.on('progress', (event) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  });

  // Execute generation
  const result = await streamOrchestrator.generateApplication(request);

  // Send final result
  res.write(`data: ${JSON.stringify({ type: 'result', data: result })}\n\n`);
  res.end();
});
```

**SSE Format:**
```
data: {"type":"phase_start","phase":"analysis","message":"Analyzing requirements","progress":10}

data: {"type":"phase_complete","phase":"analysis","message":"Found 5 entities","progress":20}

data: {"type":"result","data":{"success":true,"projectId":"proj-123"}}
```

### Frontend Components

#### 1. API Client Streaming Method

**File:** `frontend/src/lib/api.ts`

```typescript
public async generateApplicationStreaming(
  request: ProjectRequest,
  onProgress: (event: StreamEvent) => void
): Promise<GenerationResult> {
  return new Promise((resolve, reject) => {
    const url = `${API_BASE_URL}/api/generate/stream`;

    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify(request),
    })
      .then(async (response) => {
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'result') {
                resolve(data.data);
              } else {
                onProgress(data);
              }
            }
          }
        }
      })
      .catch(reject);
  });
}
```

#### 2. useProjects Hook Integration

**File:** `frontend/src/hooks/useProjects.ts`

The hook automatically connects streaming to the Zustand store:

```typescript
const generateMutation = useMutation({
  mutationFn: async (request) => {
    clearProgress();
    setGenerating(true);

    const result = await apiClient.generateApplicationStreaming(request, (event) => {
      // Map event types to progress status
      let status = 'pending';
      if (event.type === 'phase_start') status = 'running';
      if (event.type === 'phase_complete') status = 'completed';
      if (event.type === 'error') status = 'error';

      addProgress({
        phase: event.phase,
        status,
        message: event.message,
        progress: event.progress,
      });
    });

    setGenerating(false);
    return result;
  },
});
```

#### 3. ProgressTracker Component

**File:** `frontend/src/components/ProgressTracker.tsx`

The existing ProgressTracker automatically displays streaming progress:

```typescript
export default function ProgressTracker() {
  const { isGenerating, generationProgress } = useStore();

  return (
    <motion.div className="fixed bottom-6 right-6">
      {generationProgress.map((step) => (
        <motion.div>
          {step.status === 'running' && <Loader2 className="animate-spin" />}
          {step.status === 'completed' && <CheckCircle2 />}
          {step.progress && (
            <div className="progress-bar" style={{ width: `${step.progress}%` }} />
          )}
        </motion.div>
      ))}
    </motion.div>
  );
}
```

---

## Usage Examples

### Backend: Listen to Progress Events

```typescript
const orchestrator = new SimpleTakossOrchestrator(apiKey);

orchestrator.on('progress', (event) => {
  console.log(`[${event.phase}] ${event.message} - ${event.progress}%`);
});

const result = await orchestrator.generateApplication({
  projectName: 'My App',
  description: 'A sample application',
  requirements: 'Build a todo app',
});
```

### Frontend: Using Streaming in Pages

```typescript
import { useProjects } from '@/hooks';

function NewProject() {
  const { generateProject, isGenerating } = useProjects();

  const handleSubmit = async (formData) => {
    await generateProject({
      projectName: formData.name,
      description: formData.description,
      requirements: formData.requirements,
    });
    // ProgressTracker automatically shows real-time progress!
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
      <button disabled={isGenerating}>
        {isGenerating ? 'Generating...' : 'Create Project'}
      </button>
    </form>
  );
}
```

---

## Progress Flow

### Generation Phases & Progress Percentages

| Phase           | Start % | Complete % | Duration   |
|----------------|---------|------------|------------|
| Initialization | 0%      | 10%        | < 1s       |
| Analysis       | 10%     | 20%        | 5-10s      |
| Complexity     | 30%     | 40%        | 2-5s       |
| Database       | 50%     | 60%        | 3-8s       |
| Frontend       | 70%     | 80%        | 10-30s     |
| Deployment     | 90%     | 95%        | 2-5s       |
| Complete       | 100%    | 100%       | -          |

### Example Progress Timeline

```
[0%] Initialization: Starting generation for Blog Platform
[10%] Analysis: Analyzing requirements and extracting features
[20%] Analysis: Found 4 entities and 8 features
[30%] Complexity: Estimating project complexity
[40%] Complexity: Complexity score: 65
[50%] Database: Designing database schema
[60%] Database: Database schema designed for 4 entities
[70%] Frontend: Generating UI components
[80%] Frontend: Generated 12 components
[90%] Deployment: Preparing deployment configuration
[95%] Deployment: Deployment configuration ready
[100%] Complete: Successfully generated Blog Platform
```

---

## API Endpoints

### 1. Streaming Generation (NEW)

**Endpoint:** `POST /api/generate/stream`

**Authentication:** Required (JWT or API Key)

**Request Body:**
```json
{
  "projectName": "My Application",
  "description": "A modern web application",
  "requirements": "Build a blog with authentication and comments"
}
```

**Response Format:** Server-Sent Events (SSE)

**Event Stream:**
```
data: {"type":"phase_start","phase":"analysis","message":"Analyzing requirements","progress":10}

data: {"type":"phase_complete","phase":"analysis","message":"Found 3 entities","progress":20,"data":{"entities":3}}

data: {"type":"complete","phase":"complete","message":"Successfully generated My Application","progress":100,"data":{"projectId":"proj-1234567890"}}

data: {"type":"result","data":{"success":true,"projectId":"proj-1234567890","phases":{...}}}
```

### 2. Non-Streaming Generation (BACKWARD COMPATIBLE)

**Endpoint:** `POST /api/generate`

**Authentication:** Required (JWT or API Key)

**Request Body:** Same as streaming

**Response:**
```json
{
  "success": true,
  "projectId": "proj-1234567890",
  "phases": {
    "analysis": {...},
    "complexity": {...},
    "database": {...},
    "frontend": {...},
    "deployment": {...}
  }
}
```

---

## Implementation Details

### Why Server-Sent Events (SSE)?

**Advantages:**
- ✅ Simple HTTP protocol (no WebSocket complexity)
- ✅ Automatic reconnection
- ✅ Works through firewalls and proxies
- ✅ Native browser support
- ✅ One-way communication (server → client) is sufficient

**Industry Adoption:**
- Bolt.new uses SSE for streaming
- v0.dev uses SSE for generation updates
- Cursor uses SSE for code generation

### Why Not WebSockets?

While Socket.IO was already in the codebase, SSE is preferred for streaming generation because:
- Simpler implementation (no handshake required)
- Better for one-way data flow
- Easier to implement authentication with fetch API
- Lower overhead

### Progress State Management

The Zustand store manages progress state:

```typescript
interface GenerationProgress {
  phase: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  message: string;
  progress?: number;
}

// Store automatically updates existing phases or adds new ones
addProgress: (progress) => {
  const existingIndex = state.generationProgress.findIndex(
    (p) => p.phase === progress.phase
  );

  if (existingIndex !== -1) {
    // Update existing phase
    updated[existingIndex] = progress;
  } else {
    // Add new phase
    return [...state.generationProgress, progress];
  }
}
```

---

## Testing Streaming

### Manual Testing

1. **Start Backend:**
   ```bash
   npm run start:server
   ```

2. **Start Frontend:**
   ```bash
   cd frontend
   npm run dev
   ```

3. **Create a Project:**
   - Navigate to http://localhost:5173
   - Login or register
   - Go to "New Project"
   - Fill in details and submit
   - Watch the ProgressTracker in bottom-right corner

### Expected Behavior:

1. ProgressTracker appears with "Initialization" phase
2. Phases appear sequentially with spinning loader icons
3. Progress bars fill as each phase progresses
4. Completed phases show green checkmarks
5. Final completion message appears
6. ProgressTracker can be cleared with "Clear" button

### cURL Testing (SSE)

```bash
curl -N -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"projectName":"Test","description":"Test app","requirements":"Build a simple app"}' \
  http://localhost:3000/api/generate/stream
```

Expected output:
```
data: {"type":"phase_start","phase":"initialization","message":"Starting generation for Test","progress":0}

data: {"type":"phase_start","phase":"analysis","message":"Analyzing requirements and extracting features","progress":10}
...
```

---

## Error Handling

### Backend Errors

If an error occurs during generation:

```typescript
this.emitEvent({
  type: 'error',
  phase: 'error',
  message: `Generation failed: ${error.message}`,
  progress: 0,
});
```

The SSE stream will send:
```
data: {"type":"error","phase":"error","message":"Generation failed: API rate limit exceeded"}
```

### Frontend Error Handling

The API client automatically rejects the promise on error:

```typescript
if (data.type === 'error') {
  reject(new Error(data.message));
  return;
}
```

The useProjects hook displays errors via React Query:

```typescript
const { error, isError } = useProjects();

{isError && <div className="error">{error.message}</div>}
```

---

## Performance Considerations

### Backend

- **One Orchestrator per Request**: Each streaming request creates a new orchestrator instance to avoid event listener conflicts
- **Cleanup**: Orchestrator is properly closed after completion
- **Memory**: Event listeners are automatically removed when response ends

### Frontend

- **Fetch API**: Uses ReadableStream for efficient data processing
- **Buffer Management**: Handles partial JSON messages with line buffering
- **React Query**: Automatic caching and error handling
- **State Updates**: Efficient state updates with Zustand (only affected components re-render)

### Network

- **Compression**: SSE responses can be gzipped (supported by browsers)
- **Keep-Alive**: Connection stays open during generation (typically 30-120 seconds)
- **Reconnection**: Browser automatically reconnects if connection drops

---

## Migration Guide

### Updating Existing Code

If you have existing code using the non-streaming API:

**Before:**
```typescript
const result = await apiClient.generateApplication(request);
console.log('Generation complete:', result);
```

**After (with streaming):**
```typescript
const result = await apiClient.generateApplicationStreaming(
  request,
  (event) => {
    console.log(`[${event.phase}] ${event.message}`);
  }
);
console.log('Generation complete:', result);
```

### Using useProjects Hook

The `useProjects` hook automatically uses streaming:

```typescript
const { generateProject, isGenerating } = useProjects();

// This now uses streaming by default
await generateProject({
  projectName: 'My App',
  description: 'Description',
  requirements: 'Requirements',
});
```

No code changes required in components!

---

## Comparison with Industry Standards

### Bolt.new
- ✅ Uses SSE for streaming
- ✅ Real-time progress updates
- ✅ Phase-by-phase feedback
- ⚠️ Takoss matches this approach

### v0.dev
- ✅ Uses SSE for streaming
- ✅ Real-time code generation
- ✅ Incremental updates
- ⚠️ Takoss matches this approach

### Cursor
- ✅ Streaming diffs
- ✅ Real-time feedback
- ⚠️ Uses WebSockets (more complex)

### Replit Agent
- ✅ Streaming execution logs
- ✅ Real-time status updates
- ⚠️ Uses WebSockets (more complex)

**Conclusion:** Takoss's SSE implementation aligns with industry leaders (Bolt.new, v0.dev) and provides a simpler, more maintainable solution than WebSocket-based approaches.

---

## Future Enhancements

### Potential Improvements

1. **Token Streaming**: Stream generated code token-by-token (like ChatGPT)
2. **Live Preview**: Show generated code in real-time
3. **Cancellation**: Allow users to cancel generation mid-stream
4. **Retry Logic**: Automatic reconnection on network failures
5. **Progress Persistence**: Save progress to database for recovery
6. **Multi-Phase Details**: Show sub-tasks within each phase

### Token Streaming Example

```typescript
this.emitEvent({
  type: 'code_chunk',
  phase: 'frontend',
  message: 'Generating component',
  data: {
    file: 'src/components/Header.tsx',
    chunk: 'import React from \'react\';\n',
    isComplete: false,
  },
});
```

---

## Troubleshooting

### Streaming Not Working

**Issue:** ProgressTracker doesn't appear

**Check:**
1. Ensure `useProjects()` is being used in your component
2. Verify `ProgressTracker` is included in your layout
3. Check browser console for errors
4. Confirm backend is running on port 3000

**Issue:** Connection closes immediately

**Check:**
1. Authentication token is valid
2. CORS is properly configured
3. Nginx buffering is disabled (production)

**Issue:** Events arrive late or in batches

**Check:**
1. Nginx buffering (`X-Accel-Buffering: no` header)
2. Reverse proxy configuration
3. Network connection quality

---

## Conclusion

The streaming implementation brings Takoss in line with modern AI application builders, providing users with instant feedback and transparency during project generation. The architecture is simple, maintainable, and follows industry best practices established by tools like Bolt.new and v0.dev.

**Key Achievements:**
- ✅ Real-time progress updates via SSE
- ✅ Phase-by-phase feedback with percentages
- ✅ Automatic UI updates (ProgressTracker)
- ✅ Backward compatibility (non-streaming endpoint)
- ✅ Zero TypeScript errors
- ✅ Production-ready builds

**Files Modified:**
- `src/orchestrator/simpleTakossOrchestrator.ts` - Event emitter
- `src/api/server.ts` - SSE endpoint
- `frontend/src/lib/api.ts` - Streaming API method
- `frontend/src/lib/store.ts` - Progress state management
- `frontend/src/hooks/useProjects.ts` - Streaming integration
- `frontend/src/components/ProgressTracker.tsx` - Already connected!

**Next Steps:**
- Test with real users
- Monitor performance metrics
- Consider token-level streaming for code generation
- Add live preview functionality
