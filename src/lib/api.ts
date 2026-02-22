export type StoryStatus = "draft" | "published";

export interface Story {
  id: string;
  title: string;
  topic: string;
  ageGroup: string;
  language: string;
  coverImage?: string | null;
  status: StoryStatus;
  studentsReached: number;
  completionRate: number;
  createdAt: string;
}

export interface StoryChoice {
  id: string;
  text: string;
  correct: boolean;
}

export interface StorySlide {
  id: number;
  image?: string | null;
  text: string;
  choices: StoryChoice[] | null;
}

export interface DashboardStats {
  storiesCreated: number;
  studentsReached: number;
  completionRate: number;
  activeSessions: number;
}

export interface StorySearchResponse {
  stories: Story[];
  total: number;
  limit: number;
  offset: number;
}

export interface NgoLoginPayload {
  email: string;
  password: string;
}

export interface NgoSignupPayload {
  orgName: string;
  email: string;
  password: string;
}

export interface StudentProfilePayload {
  name: string;
  ageGroup: string;
  avatar?: string;
}

export interface StoryCreatePayload {
  // ✅ REFACTORED: ngoId removed - extracted from JWT token instead
  title: string;
  topic: string;
  ageGroup: string;
  language: string;
  characterCount: number;
  regionContext?: string;
  description: string;
  moralLesson?: string;
}

const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
const isLocalhostHost =
  typeof window !== "undefined" && ["localhost", "127.0.0.1"].includes(window.location.hostname);
const shouldUseProxyInDev = import.meta.env.DEV && !isLocalhostHost;
const API_BASE_URL = shouldUseProxyInDev ? window.location.origin : configuredApiBaseUrl || "http://localhost:8000";

const buildUrl = (path: string, query?: Record<string, string | undefined>) => {
  const url = new URL(path, API_BASE_URL);
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value) {
        url.searchParams.set(key, value);
      }
    });
  }
  return url.toString();
};

const request = async <T>(path: string, init?: RequestInit, query?: Record<string, string | undefined>): Promise<T> => {
  let response: Response;

  try {
    response = await fetch(buildUrl(path, query), {
      // ✅ FIXED: Merge headers properly so Content-Type and Authorization are both present
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    throw new Error("Cannot connect to API server. Ensure backend is running on http://localhost:8000 and CORS allows your frontend origin.");
  }

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const payload = await response.json();
      // ✅ Check for multiple error formats
      if (payload?.message) {
        message = payload.message;
        // ✅ Include error code if available
        if (payload?.error) {
          message = `${message} (${payload.error})`;
        }
      } else if (payload?.detail) {
        message = payload.detail;
      }
      
      // ✅ For validation errors (422), extract all field errors
      if (response.status === 422 && payload?.error) {
        console.error("Validation details:", payload.error);
      }
    } catch {
      // no-op
    }
    throw new Error(message);
  }

  return response.json() as Promise<T>;
};

export const loginNgo = (payload: NgoLoginPayload) =>
  request<{
    success: boolean;
    ngoId: string;
    email: string;
    access_token: string;  // ✅ JWT token for authenticated requests
    token_type: string;
    expires_in: number;  // seconds
  }>("/api/auth/ngo/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const signupNgo = (payload: NgoSignupPayload) =>
  request<{
    success: boolean;
    ngoId: string;
    email: string;
    orgName: string;
    access_token: string;  // ✅ JWT token for authenticated requests
    token_type: string;
    expires_in: number;  // seconds
  }>("/api/auth/ngo/signup", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const createStudentProfile = (payload: StudentProfilePayload) =>
  request<{ id: string; name: string; ageGroup: string; avatar?: string }>("/api/students", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const getStories = (params?: { status?: StoryStatus; topic?: string; ageGroup?: string }) =>
  request<Story[]>("/api/stories", undefined, {
    status: params?.status,
    topic: params?.topic,
    age_group: params?.ageGroup,
  });

export const searchStories = (
  // ✅ NEW: Search endpoint with pagination support
  q: string,
  limit: number = 10,
  offset: number = 0,
) => {
  const token = localStorage.getItem("access_token");
  return request<StorySearchResponse>("/api/stories/search", {
    headers: {
      Authorization: token ? `Bearer ${token}` : "",
    },
  }, {
    q,
    limit: String(limit),
    offset: String(offset),
  });
};

export const getStory = (storyId: string) => request<Story>(`/api/stories/${storyId}`);

export const getStorySlides = (storyId: string) => request<StorySlide[]>(`/api/stories/${storyId}/slides`);

export const createStory = (payload: StoryCreatePayload) => {
  const token = localStorage.getItem("access_token");
  return request<{ story: Story; slides: StorySlide[] }>("/api/stories", {
    method: "POST",
    headers: {
      Authorization: token ? `Bearer ${token}` : "",
    },
    body: JSON.stringify(payload),
  });
};

// ✅ NEW: Publish story endpoint
export const publishStory = (storyId: string) => {
  const token = localStorage.getItem("access_token");
  return request<Story>(`/api/stories/${storyId}/publish`, {
    method: "PATCH",
    headers: {
      Authorization: token ? `Bearer ${token}` : "",
    },
  });
};

export const getDashboardStats = () => {
  const token = localStorage.getItem("access_token");
  return request<DashboardStats>("/api/dashboard/stats", {
    headers: {
      Authorization: token ? `Bearer ${token}` : "",
    },
  });
};