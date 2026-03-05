import { YoutubeTranscript } from "youtube-transcript-plus";

const video_id: string | undefined = process.argv[2];

if (!video_id) {
  console.error("Usage: transcript.ts <video-id-or-url>");
  console.error("Example: transcript.ts EBw7gsDPAYQ");
  console.error(
    "Example: transcript.ts https://www.youtube.com/watch?v=EBw7gsDPAYQ"
  );
  process.exit(1);
}

function extract_video_id(input: string): string {
  if (input.includes("youtube.com") || input.includes("youtu.be")) {
    const match = input.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (match) {
      return match[1];
    }
  }
  return input;
}

function format_timestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}

async function main(): Promise<void> {
  const extracted_id = extract_video_id(video_id!);

  try {
    const transcript = await YoutubeTranscript.fetchTranscript(extracted_id);

    for (const entry of transcript) {
      const timestamp = format_timestamp(entry.offset / 1000);
      console.log(`[${timestamp}] ${entry.text}`);
    }
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : String(error);
    console.error("Error fetching transcript:", message);
    process.exit(1);
  }
}

main();
