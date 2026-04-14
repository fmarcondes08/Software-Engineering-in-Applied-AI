export type UserRole = 'patient' | 'doctor' | 'admin';

export type ChatRequest = {
  message: string;
  userId: string;
  userName: string;
  role: UserRole;
  guardrailsEnabled: boolean;
  threadId?: string;
  file?: File;
};

export type ChatDonePayload = {
  answer: string;
  intent?: string;
  isEmergency?: boolean;
  blocked?: boolean;
  appointmentConfirmed?: boolean;
  appointmentDoctor?: string;
  appointmentDate?: string;
  appointmentReason?: string;
  documentStored?: boolean;
};

export type StreamCallbacks = {
  onToken: (token: string) => void;
  onDone: (payload: ChatDonePayload) => void;
  onError: (message: string) => void;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export async function streamChat(request: ChatRequest, callbacks: StreamCallbacks): Promise<void> {
  let body: BodyInit;
  let headers: HeadersInit = {};

  if (request.file) {
    const form = new FormData();
    form.append('message', request.message);
    form.append('userId', request.userId);
    form.append('userName', request.userName);
    form.append('role', request.role);
    form.append('guardrailsEnabled', String(request.guardrailsEnabled));
    form.append('threadId', request.threadId ?? 'default');
    form.append('file', request.file);
    body = form;
  } else {
    headers = { 'Content-Type': 'application/json' };
    body = JSON.stringify({
      message: request.message,
      userId: request.userId,
      userName: request.userName,
      role: request.role,
      guardrailsEnabled: request.guardrailsEnabled,
      threadId: request.threadId ?? 'default',
    });
  }

  const response = await fetch(`${API_URL}/chat`, {
    method: 'POST',
    headers,
    body,
  });

  if (!response.ok || !response.body) {
    callbacks.onError(`Server error: ${response.status}`);
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let lastEvent = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (line.startsWith('event: ')) {
        lastEvent = line.slice(7).trim();
        continue;
      }
      if (line.startsWith('data: ')) {
        const rawData = line.slice(6);
        try {
          const parsed = JSON.parse(rawData);
          if (lastEvent === 'token') {
            callbacks.onToken(parsed.token ?? '');
          } else if (lastEvent === 'done') {
            callbacks.onDone(parsed as ChatDonePayload);
          } else if (lastEvent === 'error') {
            callbacks.onError(parsed.message ?? 'Unknown error');
          }
        } catch {
          // ignore malformed lines
        }
      }
    }
  }
}

export async function fetchHistory(userId: string) {
  const res = await fetch(`${API_URL}/history/${userId}`);
  if (!res.ok) return { documents: [] };
  return res.json();
}
