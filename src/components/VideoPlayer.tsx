interface VideoPlayerProps {
  embedUrl: string;
  title: string;
}

export function VideoPlayer({ embedUrl, title }: VideoPlayerProps) {
  return (
    <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
      <iframe
        src={embedUrl}
        title={title}
        className="absolute inset-0 w-full h-full rounded-lg"
        allow="autoplay; encrypted-media"
        allowFullScreen
      />
    </div>
  );
}
