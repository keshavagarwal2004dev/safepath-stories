import storyCover1 from "@/assets/story-cover-1.jpg";
import storyCover2 from "@/assets/story-cover-2.jpg";
import storyCover3 from "@/assets/story-cover-3.jpg";
import storyCover4 from "@/assets/story-cover-4.jpg";
import storyScene1 from "@/assets/story-scene-1.jpg";

export const mockStories = [
  {
    id: "1",
    title: "Rani Says No",
    topic: "Good Touch Bad Touch",
    ageGroup: "6-8",
    language: "English",
    coverImage: storyCover1,
    status: "published" as const,
    studentsReached: 234,
    completionRate: 87,
    createdAt: "2026-02-10",
  },
  {
    id: "2",
    title: "Safe Online Friends",
    topic: "Online Safety",
    ageGroup: "9-12",
    language: "Hindi",
    coverImage: storyCover2,
    status: "published" as const,
    studentsReached: 156,
    completionRate: 92,
    createdAt: "2026-02-12",
  },
  {
    id: "3",
    title: "The Park Adventure",
    topic: "Stranger Danger",
    ageGroup: "5-7",
    language: "English",
    coverImage: storyCover3,
    status: "draft" as const,
    studentsReached: 0,
    completionRate: 0,
    createdAt: "2026-02-15",
  },
  {
    id: "4",
    title: "Brave Little Hero",
    topic: "Body Autonomy",
    ageGroup: "8-10",
    language: "English",
    coverImage: storyCover4,
    status: "published" as const,
    studentsReached: 312,
    completionRate: 78,
    createdAt: "2026-02-08",
  },
];

export const mockStorySlides = [
  {
    id: 1,
    image: storyScene1,
    text: "Rani was playing in the park after school. The sun was warm and the birds were singing happily.",
    choices: null,
  },
  {
    id: 2,
    image: storyCover3,
    text: "A person Rani didn't know came to the park. 'Hello little girl, would you like some candy?' the stranger asked.",
    choices: null,
  },
  {
    id: 3,
    image: storyCover1,
    text: "Rani remembered what her teacher told her. What should Rani do?",
    choices: [
      { id: "a", text: "Say 'No thank you!' and run to a trusted adult", correct: true },
      { id: "b", text: "Take the candy and talk to the stranger", correct: false },
    ],
  },
  {
    id: 4,
    image: storyCover4,
    text: "Rani said 'No thank you!' very loudly and ran to her mother. Her mother was so proud! 'You did the right thing, Rani. You are brave and smart!'",
    choices: null,
  },
];

export const mockAvatars = ["🦁", "🐰", "🦊", "🐼", "🐸", "🦄", "🐶", "🐱"];

export const topicOptions = [
  "Good Touch Bad Touch",
  "Stranger Danger",
  "Safe & Unsafe Secrets",
  "Bullying",
  "Online Safety",
  "Body Autonomy",
];

export const ageGroupOptions = ["4-6", "5-7", "6-8", "8-10", "9-12", "12-14"];

export const languageOptions = ["English", "Hindi", "Tamil", "Telugu", "Bengali", "Marathi", "Kannada"];

export const dashboardStats = {
  storiesCreated: 24,
  studentsReached: 1847,
  completionRate: 85,
  activeSessions: 42,
};
