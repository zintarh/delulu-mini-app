// Skeleton colors that match the card palettes
const SKELETON_COLORS = [
  "#F5AAB6", // delulu pink
  "#656A3F", // void green
  "#665B87", // aura purple
  "#DCD6C0", // bag beige
  "#364378", // cloud blue
];

export function HotDeluluSkeleton() {
  return (
    <div
      className="relative rounded-3xl p-5 h-[200px] shrink-0 w-full overflow-hidden"
      style={{
        background: "linear-gradient(135deg, #f9e79f 0%, #f7dc6f 10%, #d4af37 25%)",
      }}
    >
      <div className="space-y-3 animate-pulse">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-black/20" />
          <div className="h-4 w-24 bg-black/20 rounded" />
          <div className="ml-auto h-6 w-12 bg-black/20 rounded-full" />
        </div>
        <div className="space-y-2">
          <div className="h-5 bg-black/20 rounded w-full" />
          <div className="h-5 bg-black/20 rounded w-3/4" />
        </div>
        <div className="flex items-center justify-between mt-auto">
          <div className="w-11 h-11 rounded-full bg-black/20" />
          <div className="h-6 w-16 bg-black/20 rounded" />
        </div>
      </div>
    </div>
  );
}

export function DeluluCardSkeleton({ className = "", index = 0 }: { className?: string; index?: number }) {
  // Pick a color based on index for visual variety
  const bgColor = SKELETON_COLORS[index % SKELETON_COLORS.length];
  
  return (
    <div className={`block p-4 rounded-lg h-auto space-y-3 animate-pulse ${className}`}>
      {/* Header - Avatar, Username, Time */}
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-gray-200 shrink-0" />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <div className="h-4 bg-gray-200 rounded w-24" />
            <div className="h-3 bg-gray-200 rounded w-12" />
          </div>
        </div>
      </div>

      {/* Main Card Area - 4:5 aspect ratio like the real card */}
      <div 
        className="relative w-full aspect-[4/5] rounded-xl overflow-hidden border border-gray-100"
        style={{ background: bgColor }}
      >
        {/* TVL Badge - Top Right */}
        <div className="absolute top-3 right-3 z-20">
          <div className="bg-white/30 h-7 w-20 rounded-md" />
        </div>

        {/* Headline placeholder - Center */}
        <div className="absolute inset-6 flex flex-col items-center justify-center gap-3">
          <div className="h-8 bg-black/20 rounded w-4/5" />
          <div className="h-8 bg-black/20 rounded w-3/5" />
          <div className="h-8 bg-black/20 rounded w-2/5" />
        </div>

        {/* Brand Watermark - Bottom Left */}
        <div className="absolute bottom-3 left-3 z-20">
          <div className="h-3 bg-black/20 rounded w-16" />
        </div>

        {/* Duration Badge - Bottom Right */}
        <div className="absolute bottom-3 right-3 z-20">
          <div className="h-6 bg-black/60 rounded-full w-24" />
        </div>
      </div>

      {/* Action Buttons - Share & Heart */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-gray-200 rounded" />
          <div className="h-3 bg-gray-200 rounded w-10" />
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 bg-gray-200 rounded" />
          <div className="h-3 bg-gray-200 rounded w-4" />
        </div>
      </div>

      {/* Bottom Divider */}
      <div className="border-b border-gray-200 pb-4" />
    </div>
  );
}
