type KhatounLoaderProps = {
  text?: string;
};

export function KhatounLoader({ text = "جارٍ التحقق من الجلسة..." }: KhatounLoaderProps) {
  return (
    <div dir="rtl" className="khatoun-loader-screen" role="status" aria-live="polite">
      <div className="khatoun-loader-content">
        <div className="khatoun-loader-dots" aria-hidden="true">
          <span className="khatoun-loader-dot" />
          <span className="khatoun-loader-dot" />
          <span className="khatoun-loader-dot" />
        </div>
        {text ? <p className="khatoun-loader-text">{text}</p> : null}
      </div>
    </div>
  );
}
