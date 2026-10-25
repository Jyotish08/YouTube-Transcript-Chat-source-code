import { Video, ChatResponse, ChatSource } from './api';

export interface DemoChunk {
  chunk_index: number;
  start_seconds: number;
  timestamp: string; // "m:ss" or "mm:ss"
  content: string;
}

export interface DemoVideoData extends Video {
  is_demo: true;
  author: string;
  duration: string;
  tag: string;
  summary: string;
  suggestedQuestions: string[];
  chunks: DemoChunk[];
}

export const DEMO_VIDEOS: DemoVideoData[] = [
  {
    id: 'demo-devpost-judging',
    youtube_url: 'https://youtu.be/Xh8Ie_VuA_0',
    title: 'What Do Hackathon Judges Look For? 5 Live AI App Reviews',
    author: 'Joe Holmes (Devpost Learn)',
    duration: '~52 mins',
    tag: 'Official Hackathon Guide',
    summary: 'Devpost AI Learning Hackathon Architect breaks down judging reality, scoring pillars, and reviews 5 real AI submissions.',
    status: 'done',
    error_message: null,
    created_at: new Date(Date.now() - 3600000).toISOString(),
    updated_at: new Date(Date.now() - 3600000).toISOString(),
    is_demo: true,
    suggestedQuestions: [
      'What are the 3 primary pillars judges evaluate?',
      'Why did ResumeDB lose points on the auth gate?',
      'How long do I have to show working software in the video?',
      'What is the single biggest factor separating winning projects?',
      'How many times is "friction" mentioned?',
    ],
    chunks: [
      {
        chunk_index: 0,
        start_seconds: 0,
        timestamp: '0:00',
        content: `[0:00] Welcome, everyone, to this live review session for the Build With AI: Basics learning hackathon. Over the past couple of weeks, developers and creators from all backgrounds have built projects using modern AI coding tools. Today, we're doing something candid: opening up actual submitted projects, walking through them as a judge, and breaking down what makes a project score at the top versus what accidentally sinks an otherwise promising build.`,
      },
      {
        chunk_index: 1,
        start_seconds: 85,
        timestamp: '1:25',
        content: `[1:25] Let's talk about the reality of hackathon judging. Judges evaluate dozens—sometimes hundreds—of projects in a single sitting. They are looking at three primary pillars: Design, Innovation and Idea, and Presentation. When a judge loads your Devpost page, they don't have twenty minutes to decipher cryptic setup instructions or debug environment variables. You have approximately 5 to 10 seconds on the landing page to communicate: What does this do, and who is it built for? If a judge is confused by your headline or can't access the core feature, you've lost points before they even evaluate your code.`,
      },
      {
        chunk_index: 2,
        start_seconds: 196,
        timestamp: '3:16',
        content: `[3:16] The biggest trap with AI-assisted software right now isn't writing code—it's that default AI scaffolding looks identical. When you tell Claude or Cursor to 'build a sleek dashboard', everyone gets the exact same slate-gray cards, generic Lucide icons, and placeholder text. Standing out requires deliberate intentionality. Today we're reviewing five real submissions live to see what's hitting the mark, where points are leaking, and exact steps to polish your project. Core Judge Heuristic: Judges evaluate cognitive load first. If accessing the app requires manual registration, email verification, or configuration, the review starts at a severe scoring disadvantage.`,
      },
      {
        chunk_index: 3,
        start_seconds: 350,
        timestamp: '5:50',
        content: `[5:50] Let's look at our first project: ResumeDB. The concept is valuable—indexing resume data and querying it using semantic search. But notice what happens the second I click 'Launch App': I hit a mandatory registration and sign-in gate. There is no demo account pre-filled, no bypass switch, and no sample database loaded. An auth wall can end a review before the app is ever seen. If a judge has to pull up a disposable email address, verify a code, create a password, and upload five sample PDF resumes just to test if your semantic search works, they simply won't have time. The Fix: Provide a visible 'Judge / Demo Login' button directly on the sign-in modal, or better yet, make demo data publicly navigable in read-only mode with rich pre-indexed candidate profiles. Verdict: Strong technical architecture, but hindered by friction. Always include prepopulated demo state so judges experience the "aha!" moment in under 15 seconds.`,
      },
      {
        chunk_index: 4,
        start_seconds: 745,
        timestamp: '12:25',
        content: `[12:25] Moving on to Stand. The immediate strength here is clarity. Within two seconds of opening the page, the headline reads: 'Gentle, posture-adaptive posture reminders tailored to your calendar'. You instantly understand who it's for and the exact pain point it addresses. However, let's critique the presentation pacing. In the demo video submitted on Devpost, the first 75 seconds were spent walking through introductory slides explaining why sedentary work is bad for your back. Don't teach judges the problem domain in a 3-minute video; judges already know sitting too long is unhealthy. Show the software running immediately. Get into the workflow, show the adaptive timer, and trigger the AI agent posture check in minute one. Verdict: Exceptional copy and immediate value proposition. Presentation suffered from a slide-heavy demo video. Always show working software within 45 seconds.`,
      },
      {
        chunk_index: 5,
        start_seconds: 1180,
        timestamp: '19:40',
        content: `[19:40] Next up is Ghostlisted, an app designed to track job applications and alert users when companies are ghosting them. What I love here is the visual identity. This does not look like default v0 or Tailwind Starter UI. The author used a custom, playful dark-mode palette, crisp iconography, and distinct typographic hierarchy that feels like an intentional brand. Where this submission fell short was form validation and empty states. When I entered an invalid job URL, the entire dashboard threw an unhandled React error boundary instead of a friendly validation message. When an empty table had no records, it showed a broken border rather than a clean zero-state illustration prompting an action. Verdict: High marks in Design & Innovation. Needs defensive input handling and graceful UI error boundaries to secure top technical scores.`,
      },
      {
        chunk_index: 6,
        start_seconds: 1595,
        timestamp: '26:35',
        content: `[26:35] Let's examine Freelancer Swipe. This project applies card-swiping mechanics to client gig listings. It’s an engaging, intuitive concept. But look at the demo data loaded onto the cards: every listing says 'Test Job 1', 'Lorem ipsum dolor sit amet', and the client names are all 'User 123'. Using fake or generic placeholder text severely degrades the perceived quality of your build. High-scoring hackathon projects use realistic, authentic-feeling demo data: actual project briefs, realistic budgets, and sensible portfolio tags. Additionally, examine the UI wording: buttons labeled 'Action Handler Submit' or technical database field names should be rewritten into natural, human language like 'Send Proposal' or 'Decline Gig'. Polishing UI wording costs zero lines of code but completely transforms judge perception. Verdict: Highly engaging UX concept. Lost points due to raw placeholder copy and developer-centric button labels instead of polished product copy.`,
      },
      {
        chunk_index: 7,
        start_seconds: 2260,
        timestamp: '37:40',
        content: `[37:40] Our fifth project is Dev Cadence, and it’s submitted as a Chrome extension rather than a traditional web application. This brings up an important point: a hackathon project does not have to be a full-stack SaaS website. Extensions, CLIs, local agents, and mobile packages are 100% eligible unless specified otherwise by the hackathon rules. Dev Cadence monitors your pull request rhythm right in the browser toolbar. In their demo video, they nailed the demonstration: within 20 seconds, they showed how the extension overlays unobtrusive health badges on an active GitHub pull request, demonstrated an AI agent summarizing pending review comments, and walked through user settings. Their demo video feedback was overwhelmingly positive because it prioritized user workflow over setup narration. Verdict: Best-in-class demo video execution. Clear value delivery, zero onboarding friction, and excellent proof of working software.`,
      },
      {
        chunk_index: 8,
        start_seconds: 2775,
        timestamp: '46:15',
        content: `[46:15] Live Audience Q&A: Rules, Eligibility & Judging Nuance. Q: Does my hackathon submission have to be 100% completely original? Joe Holmes: No. Hackathons do not require you to invent a brand new category of computing that never existed before. You can take an existing workflow—like invoice matching, flashcards, or candidate screening—and apply AI to solve it significantly faster, more elegantly, or for an underserved niche. Innovation is judged on how clever your solution is, not whether you invented the wheel from scratch.`,
      },
      {
        chunk_index: 9,
        start_seconds: 2925,
        timestamp: '48:45',
        content: `[48:45] Q: Can I use authentication if my app needs to store personal user data? Joe Holmes: Yes, absolutely. Authentication is fine and often necessary. But you must eliminate friction for the judges: either provide pre-filled test credentials directly in your submission text and login screen, or build a 'Judge Quick Access' toggle that instantly logs into a sandbox environment with active data. Never make a judge wait for an email confirmation link.`,
      },
      {
        chunk_index: 10,
        start_seconds: 2985,
        timestamp: '49:45',
        content: `[49:45] Q: Does a Chrome extension submission need to be published on the Chrome Web Store? Joe Holmes: For Build With AI: Basics, publishing to the Chrome Web Store is not mandatory, though it is recommended if time permits. You can submit a GitHub link with clear instructions on loading the unpacked extension in developer mode, provided your demo video clearly proves the extension working end-to-end.`,
      },
      {
        chunk_index: 11,
        start_seconds: 3051,
        timestamp: '50:51',
        content: `[50:51] Q: What is the single biggest factor that separates winning projects from the rest? Joe Holmes: Cohesion. A winner isn't necessarily the person who wrote the most lines of code or chained eight different LLMs together. It's the team whose demo video, user interface, and core technical feature align into a tight, understandable, working product that fulfills its stated promise without breaking. Pre-Flight Checklist: Landing page hero explains the app in 5 seconds; Judge test credentials / bypass mode clearly visible; No unhandled input exceptions or broken null tables. Demo Video Checklist: Video shows working software in under 60 seconds; All dummy/lorem ipsum replaced with realistic data; High-quality audio narration without background noise.`,
      },
    ],
  },
  {
    id: 'demo-steve-jobs',
    youtube_url: 'https://www.youtube.com/watch?v=UF8uR6Z6KLc',
    title: "Steve Jobs' 2005 Stanford Commencement Address",
    author: 'Steve Jobs (Stanford University)',
    duration: '~15 mins',
    tag: 'Classic Keynote',
    summary: 'Steve Jobs tells three personal stories: connecting the dots, love and loss, and death.',
    status: 'done',
    error_message: null,
    created_at: new Date(Date.now() - 7200000).toISOString(),
    updated_at: new Date(Date.now() - 7200000).toISOString(),
    is_demo: true,
    suggestedQuestions: [
      'What are the three stories Steve Jobs tells?',
      'What did he say about calligraphy and connecting the dots?',
      'What was his reflection on getting fired from Apple?',
      'What is the quote from The Whole Earth Catalog?',
      'How many times does he say "dots"?',
    ],
    chunks: [
      {
        chunk_index: 0,
        start_seconds: 0,
        timestamp: '0:00',
        content: `[0:00] I am honored to be with you today at your commencement from one of the finest universities in the world. I never graduated from college. Truth be told, this is the closest I've ever gotten to a college graduation. Today I want to tell you three stories from my life. That's it. No big deal. Just three stories.`,
      },
      {
        chunk_index: 1,
        start_seconds: 88,
        timestamp: '1:28',
        content: `[1:28] The first story is about connecting the dots. I dropped out of Reed College after the first 6 months, but then stayed around as a drop-in for another 18 months or so before I really quit. So why did I drop out? It started before I was born. My biological mother was a young, unwed college graduate student, and she decided to put me up for adoption.`,
      },
      {
        chunk_index: 2,
        start_seconds: 224,
        timestamp: '3:44',
        content: `[3:44] Reed College offered perhaps the best calligraphy instruction in the country. Throughout the campus every poster, every label on every drawer, was beautifully hand calligraphed. Because I had dropped out and didn't have to take the normal classes, I decided to take a calligraphy class to learn how to do this. I learned about serif and sans serif typefaces, about varying the amount of space between different letter combinations, about what makes great typography great. It was beautiful, historical, artistically subtle in a way that science can't capture, and I found it fascinating.`,
      },
      {
        chunk_index: 3,
        start_seconds: 310,
        timestamp: '5:10',
        content: `[5:10] None of this had even a hope of any practical application in my life. But ten years later, when we were designing the first Macintosh computer, it all came back to me. And we designed it all into the Mac. It was the first computer with beautiful typography. If I had never dropped in on that single course in college, the Mac would have never had multiple typefaces or proportionally spaced fonts. And since Windows just copied the Mac, it's likely no personal computer would have them. Again, you can't connect the dots looking forward; you can only connect them looking backwards. So you have to trust that the dots will somehow connect in your future.`,
      },
      {
        chunk_index: 4,
        start_seconds: 405,
        timestamp: '6:45',
        content: `[6:45] My second story is about love and loss. I was lucky — I found what I loved to do early in life. Woz and I started Apple in my parents garage when I was 20. We worked hard, and in 10 years Apple had grown from just the two of us in a garage into a $2 billion company with over 4000 employees. We had just released our finest creation — the Macintosh — a year earlier, and I had just turned 30. And then I got fired. How can you get fired from a company you started? Well, as Apple grew we hired someone who I thought was very talented to run the company with me, and for the first year or so things went well. But then our visions of the future began to diverge and eventually we had a falling out.`,
      },
      {
        chunk_index: 5,
        start_seconds: 535,
        timestamp: '8:55',
        content: `[8:55] I didn't see it then, but it turned out that getting fired from Apple was the best thing that could have ever happened to me. The heaviness of being successful was replaced by the lightness of being a beginner again, less sure about everything. It freed me to enter one of the most creative periods of my life. During the next five years, I started a company named NeXT, another company named Pixar, and fell in love with an amazing woman who would become my wife. Pixar went on to create the world's first computer animated feature film, Toy Story, and is now the most successful animation studio in the world. In a remarkable turn of events, Apple bought NeXT, I returned to Apple, and the technology we developed at NeXT is at the heart of Apple's current renaissance.`,
      },
      {
        chunk_index: 6,
        start_seconds: 680,
        timestamp: '11:20',
        content: `[11:20] My third story is about death. When I was 17, I read a quote that went something like: 'If you live each day as if it was your last, someday you'll most certainly be right.' It made an impression on me, and since then, for the past 33 years, I have looked in the mirror every morning and asked myself: 'If today were the last day of my life, would I want to do what I am about to do today?' And whenever the answer has been 'No' for too many days in a row, I know I need to change something. Remembering that I'll be dead soon is the most important tool I've ever encountered to help me make the big choices in life. Because almost everything — all external expectations, all pride, all fear of embarrassment or failure — these things just fall away in the face of death, leaving only what is truly important.`,
      },
      {
        chunk_index: 7,
        start_seconds: 820,
        timestamp: '13:40',
        content: `[13:40] When I was young, there was an amazing publication called The Whole Earth Catalog, which was one of the bibles of my generation. It was created by a fellow named Stewart Brand not far from here in Menlo Park, and he brought it to life with his poetic touch. On the back cover of their final issue was a photograph of an early morning country road, the kind you might find yourself hitchhiking on if you were so adventurous. Beneath it were the words: 'Stay Hungry. Stay Foolish.' It was their farewell message as they signed off. Stay Hungry. Stay Foolish. And I have always wished that for myself. And now, as you graduate to begin anew, I wish that for you. Stay Hungry. Stay Foolish.`,
      },
    ],
  },
  {
    id: 'demo-andrej-karpathy',
    youtube_url: 'https://www.youtube.com/watch?v=bZQun8Y4L2A',
    title: 'State of GPT | Andrej Karpathy (Microsoft Build 2023)',
    author: 'Andrej Karpathy (former OpenAI Director of AI)',
    duration: '~42 mins',
    tag: 'Technical AI Masterclass',
    summary: 'A deep dive into how modern LLMs are trained: Pretraining, Supervised Fine-Tuning (SFT), RLHF, and effective prompting.',
    status: 'done',
    error_message: null,
    created_at: new Date(Date.now() - 10800000).toISOString(),
    updated_at: new Date(Date.now() - 10800000).toISOString(),
    is_demo: true,
    suggestedQuestions: [
      'What are the 4 stages of training an LLM?',
      'How does Supervised Fine-Tuning differ from pretraining?',
      'What is RLHF and why is it used?',
      'What are the mental models for prompt engineering?',
      'How many times does he say "tokens"?',
    ],
    chunks: [
      {
        chunk_index: 0,
        start_seconds: 35,
        timestamp: '0:35',
        content: `[0:35] Hello everyone, welcome. In this talk, I want to give you a mental model for how Large Language Models like ChatGPT and GPT-4 are trained and how you should think about prompting them effectively. We train these models in four distinct stages: Pretraining, Supervised Fine-Tuning (SFT), Reward Modeling, and Reinforcement Learning from Human Feedback (RLHF).`,
      },
      {
        chunk_index: 1,
        start_seconds: 240,
        timestamp: '4:00',
        content: `[4:00] Stage 1 is Pretraining. This is where 99% of the computational cost and training time is spent. We take a massive scrape of the internet—trillions of tokens of text—and train a neural network to predict the next token. A base model is not an assistant; it is a document completer. If you prompt a base model with 'Write a poem about trees', it might complete it with 'and flowers, chapter 2' because it thinks it is completing an anthology index.`,
      },
      {
        chunk_index: 2,
        start_seconds: 680,
        timestamp: '11:20',
        content: `[11:20] Stage 2 is Supervised Fine-Tuning (SFT). Here, human contractors write prompt-response pairs: 'Write a poem about trees' followed by an actual high-quality poem. We fine-tune the base model on tens of thousands of these conversational dialogues. The model learns the conversational format and persona of a helpful assistant.`,
      },
      {
        chunk_index: 3,
        start_seconds: 1120,
        timestamp: '18:40',
        content: `[18:40] Stage 3 and 4 are Reinforcement Learning from Human Feedback (RLHF). We collect comparison data where humans rank multiple model completions, train a Reward Model to score answers, and use PPO (Proximal Policy Optimization) to tune the model toward helpful, honest, and harmless responses. RLHF slightly reduces raw creative entropy but dramatically boosts alignment and user satisfaction.`,
      },
      {
        chunk_index: 4,
        start_seconds: 1740,
        timestamp: '29:00',
        content: `[29:00] When it comes to prompting, think of the LLM as an actor trying to play a role. Give it context, give it a persona, and provide few-shot examples. LLMs do not have an inner monologue unless you give them tokens to think. Ask the model to 'think step by step' or show its reasoning before giving the final answer. You are trading compute at inference time for higher cognitive quality.`,
      },
    ],
  },
];

/**
 * Searches the demo transcript chunks for a question.
 * Supports exact mention counting and semantic-like keyword relevancy.
 */
export function queryDemoTranscript(video: DemoVideoData, question: string): ChatResponse {
  const qLower = question.toLowerCase().trim();

  // 1. Mention count detection
  const isCount = /how many times|how often|count (of|how many)|number of times/i.test(question);
  if (isCount) {
    let keyword = '';
    const quoteMatch = question.match(/["'“]([^"'”]+)["'”]/);
    if (quoteMatch) {
      keyword = quoteMatch[1].trim();
    } else {
      const matchAfter = question.match(/(?:say|saying|mention|mentioning|use|using|word)\s+([a-z0-9 _-]{2,30})/i);
      const matchBefore = question.match(/([a-z0-9 _-]{2,30})\s+(?:is mentioned|mentioned|appears|appear|occurs|occurred)/i);
      if (matchAfter) {
        keyword = matchAfter[1].trim();
      } else if (matchBefore) {
        keyword = matchBefore[1].trim();
      } else {
        // Fallback: take the last word that is not a stop word or question mark
        const words = qLower.replace(/[?!.,]/g, '').split(/\s+/).filter(w => !['how', 'many', 'times', 'is', 'does', 'the', 'word', 'term'].includes(w));
        keyword = words.pop() || '';
      }
    }

    if (keyword) {
      const pattern = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
      let totalCount = 0;
      const matchedChunks: DemoChunk[] = [];

      video.chunks.forEach((chunk) => {
        const matches = chunk.content.match(pattern);
        if (matches && matches.length > 0) {
          totalCount += matches.length;
          matchedChunks.push(chunk);
        }
      });

      const videoBaseUrl = video.youtube_url.includes('?')
        ? video.youtube_url
        : `${video.youtube_url}?v=`;

      const sources: ChatSource[] = matchedChunks.map((c) => ({
        chunk_index: c.chunk_index,
        similarity: 1.0,
        start_seconds: c.start_seconds,
        timestamp: c.timestamp,
        url: buildYoutubeTimestampUrl(video.youtube_url, c.start_seconds),
      }));

      const timestampList = sources.map((s) => `[${s.timestamp}]`).join(', ');

      return {
        answer: `The word or phrase "${keyword}" is mentioned **${totalCount} time${totalCount === 1 ? '' : 's'}** across the transcript in this video${
          totalCount > 0 ? ` (at ${timestampList})` : ''
        }.`,
        sources,
        video_title: video.title || 'Demo Video',
      };
    }
  }

  // 2. Keyword & semantic relevance ranking
  const stopWords = new Set(['what', 'when', 'where', 'which', 'who', 'whom', 'this', 'that', 'with', 'from', 'about', 'does', 'have', 'been', 'were', 'the', 'and', 'for', 'are', 'was']);
  const tokens = qLower
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w));

  const scored = video.chunks.map((chunk) => {
    const chunkLower = chunk.content.toLowerCase();
    let score = 0;

    for (const token of tokens) {
      if (chunkLower.includes(token)) {
        score += 3;
        // Exact word boundary bonus
        if (new RegExp(`\\b${token}\\b`, 'i').test(chunkLower)) {
          score += 2;
        }
      }
    }

    // Proximity / thematic bonuses for key queries
    if (qLower.includes('pillar') || qLower.includes('evaluate') || qLower.includes('look for')) {
      if (chunk.content.includes('three primary pillars')) score += 10;
    }
    if (qLower.includes('resumedb') || qLower.includes('auth') || qLower.includes('gate') || qLower.includes('login')) {
      if (chunk.content.includes('ResumeDB')) score += 12;
    }
    if (qLower.includes('stand') || qLower.includes('slide') || qLower.includes('demo video') || qLower.includes('45 seconds') || qLower.includes('working software')) {
      if (chunk.content.includes('Stand') || chunk.content.includes('45 seconds')) score += 10;
    }
    if (qLower.includes('ghostlisted') || qLower.includes('validation') || qLower.includes('error boundary')) {
      if (chunk.content.includes('Ghostlisted')) score += 12;
    }
    if (qLower.includes('freelancer') || qLower.includes('placeholder') || qLower.includes('lorem')) {
      if (chunk.content.includes('Freelancer Swipe')) score += 12;
    }
    if (qLower.includes('cadence') || qLower.includes('extension') || qLower.includes('github')) {
      if (chunk.content.includes('Dev Cadence')) score += 12;
    }
    if (qLower.includes('single biggest') || qLower.includes('winning') || qLower.includes('cohesion')) {
      if (chunk.content.includes('Cohesion')) score += 15;
    }
    if (qLower.includes('original') || qLower.includes('invent')) {
      if (chunk.content.includes('completely original')) score += 12;
    }
    // Steve Jobs specific
    if (qLower.includes('dots') || qLower.includes('calligraphy')) {
      if (chunk.content.includes('connecting the dots') || chunk.content.includes('calligraphy')) score += 10;
    }
    if (qLower.includes('fired') || qLower.includes('garage') || qLower.includes('pixar') || qLower.includes('next')) {
      if (chunk.content.includes('fired from Apple') || chunk.content.includes('Pixar')) score += 10;
    }
    if (qLower.includes('death') || qLower.includes('mirror') || qLower.includes('last day')) {
      if (chunk.content.includes('third story is about death')) score += 10;
    }
    if (qLower.includes('hungry') || qLower.includes('foolish') || qLower.includes('catalog')) {
      if (chunk.content.includes('Whole Earth Catalog')) score += 12;
    }
    // Karpathy specific
    if (qLower.includes('stage') || qLower.includes('pretrain') || qLower.includes('sft') || qLower.includes('rlhf')) {
      if (chunk.content.includes('four distinct stages') || chunk.content.includes('Pretraining')) score += 10;
    }
    if (qLower.includes('prompt') || qLower.includes('step by step') || qLower.includes('actor')) {
      if (chunk.content.includes('actor trying to play a role')) score += 10;
    }

    return { chunk, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const topMatches = scored.filter((s) => s.score > 0).slice(0, 3);

  if (topMatches.length === 0) {
    // Fall back to first 2 chunks as context
    const fallback = video.chunks.slice(0, 2);
    return {
      answer: `I could not find a direct mention answering "${question}" in the transcript segments for this video. You can try asking about the main topics covered or ask for a summary of the video.`,
      sources: fallback.map((c) => ({
        chunk_index: c.chunk_index,
        similarity: 0.35,
        start_seconds: c.start_seconds,
        timestamp: c.timestamp,
        url: buildYoutubeTimestampUrl(video.youtube_url, c.start_seconds),
      })),
      video_title: video.title || 'Demo Video',
    };
  }

  const primary = topMatches[0].chunk;
  const sources: ChatSource[] = topMatches.map((m, idx) => ({
    chunk_index: m.chunk.chunk_index,
    similarity: Math.min(0.98 - idx * 0.08, 0.99),
    start_seconds: m.chunk.start_seconds,
    timestamp: m.chunk.timestamp,
    url: buildYoutubeTimestampUrl(video.youtube_url, m.chunk.start_seconds),
  }));

  // Synthesize answer based on top matching chunk content
  const cleanExcerpt = primary.content.replace(/^\[\d+:\d+\]\s*/, '');
  let synthesizedAnswer = '';

  if (video.id === 'demo-devpost-judging') {
    if (qLower.includes('pillar') || qLower.includes('evaluate') || qLower.includes('look for')) {
      synthesizedAnswer = `Judges evaluate projects across **three primary pillars** [${primary.timestamp}]:\n\n1. **Design & UX**: Distinctive styling moving beyond default AI templates, intuitive layout, zero UI friction, and graceful error handling.\n2. **Innovation & Idea**: A fresh angle on an existing workflow or novel execution with a direct problem-to-solution mapping communicated in 5–10 seconds.\n3. **Presentation & Demo**: Showing working software within the first 45–60 seconds of the demo video, frictionless guest access, and preloaded state.\n\nJoe Holmes stresses that judges evaluate cognitive load first — if accessing your app requires manual signups or complex setup, the score drops before they even evaluate your code.`;
    } else if (qLower.includes('resumedb') || qLower.includes('auth') || qLower.includes('gate')) {
      synthesizedAnswer = `**ResumeDB** lost critical points because clicking "Launch App" presented a **mandatory registration and sign-in gate** with no pre-filled demo account or sample database loaded [${primary.timestamp}].\n\nJoe Holmes explains that having to verify emails or upload sample files causes judges to run out of time. **The Fix:** Provide a visible "Judge / Demo Login" button directly on the sign-in modal, or make demo data publicly navigable in read-only mode so judges get an "aha!" moment in under 15 seconds.`;
    } else if (qLower.includes('stand') || qLower.includes('slide') || qLower.includes('demo video') || qLower.includes('45 seconds') || qLower.includes('working software')) {
      synthesizedAnswer = `While **Stand** had exceptional headline clarity within 2 seconds, its demo video spent the first 75 seconds on slides explaining why sitting is bad for back health [${primary.timestamp}].\n\n**The Rule:** Never spend the first minute explaining the problem domain in a 3-minute hackathon video. Judges already understand the problem. Always show working software within **45 to 60 seconds**.`;
    } else if (qLower.includes('ghostlisted') || qLower.includes('error boundary') || qLower.includes('validation')) {
      synthesizedAnswer = `**Ghostlisted** scored high on visual identity and branding, but failed on **form validation and empty states** [${primary.timestamp}]. When an invalid URL was entered, the dashboard crashed into an unhandled React error boundary instead of showing a friendly error message, and empty tables showed broken borders. Hackathons require defensive input handling to secure top technical scores.`;
    } else if (qLower.includes('freelancer') || qLower.includes('placeholder') || qLower.includes('lorem')) {
      synthesizedAnswer = `**Freelancer Swipe** lost points because all its cards used raw placeholder data like "Test Job 1", "Lorem ipsum", and "User 123", with developer-centric button labels like "Action Handler Submit" [${primary.timestamp}].\n\nHigh-scoring submissions always use realistic, authentic demo data and human product language (like "Send Proposal" or "Decline Gig"). Polishing UI wording costs zero lines of code but completely transforms judge perception.`;
    } else if (qLower.includes('single biggest') || qLower.includes('winning') || qLower.includes('cohesion')) {
      synthesizedAnswer = `The single biggest factor that separates winning projects is **Cohesion** [${primary.timestamp}].\n\nA winner isn't necessarily the person who wrote the most lines of code or chained eight different LLMs together. It's the team whose demo video, user interface, and core technical feature align into a tight, understandable, working product that fulfills its stated promise without breaking.`;
    } else if (qLower.includes('original') || qLower.includes('invent')) {
      synthesizedAnswer = `No, hackathons **do not** require you to invent a brand new category of computing that never existed before [${primary.timestamp}]. You can take an existing workflow (like invoice matching, flashcards, or candidate screening) and apply AI to solve it significantly faster, more elegantly, or for an underserved niche. Innovation is judged on how clever your solution is.`;
    } else {
      synthesizedAnswer = `Based on the session transcript [${primary.timestamp}]:\n\n"${cleanExcerpt}"`;
    }
  } else if (video.id === 'demo-steve-jobs') {
    if (qLower.includes('three stories') || qLower.includes('stories')) {
      synthesizedAnswer = `Steve Jobs shares **three stories** from his life [${primary.timestamp}]:\n\n1. **Connecting the Dots**: Dropping out of college, auditing calligraphy classes, and how that unexpectedly led to beautiful typography on the Macintosh.\n2. **Love and Loss**: Getting fired from Apple at 30, founding NeXT and Pixar, and returning to Apple.\n3. **Death**: Living each day as if it were his last, and how remembering mortality strips away all external expectations leaving only what is truly important. He closes with the motto "Stay Hungry. Stay Foolish."`;
    } else if (qLower.includes('calligraphy') || qLower.includes('dots')) {
      synthesizedAnswer = `Steve Jobs took a calligraphy class at Reed College after dropping out, learning about serif and sans-serif typefaces and proportional spacing [${primary.timestamp}]. Ten years later, he incorporated all of that into the original Macintosh, making it the first personal computer with beautiful typography. His lesson was: *"You can't connect the dots looking forward; you can only connect them looking backwards. You have to trust that the dots will somehow connect in your future."*`;
    } else if (qLower.includes('fired') || qLower.includes('loss') || qLower.includes('apple') || qLower.includes('pixar')) {
      synthesizedAnswer = `Getting fired from Apple at age 30 initially felt devastating, but Jobs realized it was the best thing that could have happened to him [${primary.timestamp}]. The heaviness of success was replaced by the lightness of being a beginner again. It freed him to start NeXT, create Pixar (which made Toy Story), and find his wife. Eventually, Apple acquired NeXT, and its technology formed the foundation of Apple's renaissance.`;
    } else if (qLower.includes('death') || qLower.includes('mirror')) {
      synthesizedAnswer = `Jobs reflects on looking in the mirror every morning for 33 years asking: *"If today were the last day of my life, would I want to do what I am about to do today?"* [${primary.timestamp}]. When the answer was "No" for too many days, he knew he needed change. He emphasizes that remembering you will be dead soon is the most important tool to avoid the trap of thinking you have something to lose.`;
    } else if (qLower.includes('hungry') || qLower.includes('foolish') || qLower.includes('catalog')) {
      synthesizedAnswer = `The quote *"Stay Hungry. Stay Foolish."* came from the back cover of the final issue of **The Whole Earth Catalog**, created by Stewart Brand [${primary.timestamp}]. Jobs adopted it as his lifelong wish, and passed it on as his graduation blessing to the Stanford class.`;
    } else {
      synthesizedAnswer = `From Steve Jobs' address [${primary.timestamp}]:\n\n"${cleanExcerpt}"`;
    }
  } else if (video.id === 'demo-andrej-karpathy') {
    if (qLower.includes('stage') || qLower.includes('stages') || qLower.includes('training')) {
      synthesizedAnswer = `Andrej Karpathy outlines the **4 stages of LLM training** [${primary.timestamp}]:\n\n1. **Pretraining**: 99% of compute/time. Predicting the next token on trillions of internet tokens (creates a base document completer).\n2. **Supervised Fine-Tuning (SFT)**: Training on tens of thousands of human-written prompt/response pairs to instill conversational assistant behavior.\n3. **Reward Modeling**: Collecting human rankings between completions and training a scoring network.\n4. **Reinforcement Learning from Human Feedback (RLHF)**: Tuning via PPO to align models toward helpful, honest, and harmless answers.`;
    } else if (qLower.includes('prompt') || qLower.includes('step by step') || qLower.includes('actor')) {
      synthesizedAnswer = `Karpathy suggests thinking of an LLM as **an actor trying to play a role** [${primary.timestamp}]. Give it clear context, a specific persona, and few-shot examples. Crucially, LLMs have no inner monologue unless you give them tokens to compute — asking the model to *"think step by step"* trades inference tokens for higher reasoning quality.`;
    } else {
      synthesizedAnswer = `From Andrej Karpathy's State of GPT [${primary.timestamp}]:\n\n"${cleanExcerpt}"`;
    }
  } else {
    synthesizedAnswer = `From the transcript [${primary.timestamp}]:\n\n"${cleanExcerpt}"`;
  }

  return {
    answer: synthesizedAnswer,
    sources,
    video_title: video.title || 'Demo Video',
  };
}

/**
 * Builds a valid YouTube deep-link timestamp URL
 */
export function buildYoutubeTimestampUrl(url: string, seconds: number): string {
  try {
    const isShort = url.includes('youtu.be/');
    if (isShort) {
      const id = url.split('youtu.be/')[1].split(/[?&#]/)[0];
      return `https://youtu.be/${id}?t=${seconds}s`;
    }
    const clean = url.split('&t=')[0].split('?t=')[0];
    const separator = clean.includes('?') ? '&' : '?';
    return `${clean}${separator}t=${seconds}s`;
  } catch {
    return `${url}&t=${seconds}s`;
  }
}

/**
 * Extracts YouTube video ID from various YouTube URL variants
 */
export function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();

  // Handle youtu.be/<id>
  const beMatch = trimmed.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (beMatch) return beMatch[1];

  // Handle youtube.com/watch?v=<id>
  const watchMatch = trimmed.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (watchMatch) return watchMatch[1];

  // Handle youtube.com/shorts/<id>
  const shortsMatch = trimmed.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
  if (shortsMatch) return shortsMatch[1];

  // Handle youtube.com/embed/<id>
  const embedMatch = trimmed.match(/\/embed\/([a-zA-Z0-9_-]{11})/);
  if (embedMatch) return embedMatch[1];

  // Direct 11-char ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;

  return null;
}
