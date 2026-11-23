import Image from "next/image";

const PHOTO_ALT = "Kereta cepat Whoosh berhenti di peron Stasiun Halim";

export function AuthBrandLockup() {
  return (
    <div className="relative flex items-center gap-3">
      <div className="flex size-10 items-center justify-center rounded-xl bg-white font-semibold text-primary">
        RV
      </div>
      <div>
        <p className="text-sm font-semibold tracking-tight">RailwayVision AI</p>
        <p className="text-[11px] text-[color:var(--rv-sidebar-muted)]">
          Pendukung keputusan inspeksi · prototipe PT KCIC
        </p>
      </div>
    </div>
  );
}

export function AuthPhotoBackdrop() {
  return (
    <>
      <Image
        src="/login-halim-whoosh.png"
        alt={PHOTO_ALT}
        fill
        quality={90}
        sizes="(min-width: 1024px) 51vw, 100vw"
        className="object-cover"
        style={{ objectPosition: "72% 58%" }}
      />
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0b0b0f]/90 via-[#0b0b0f]/35 to-[#0b0b0f]/10"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#0b0b0f]/80 via-[#0b0b0f]/25 to-transparent"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute left-0 top-0 h-56 w-[480px]"
        style={{
          backgroundImage:
            "radial-gradient(ellipse at top left, rgba(11,11,15,0.9), transparent 70%)",
        }}
        aria-hidden="true"
      />
    </>
  );
}

export function AuthPhotoBanner({ className = "" }: { className?: string }) {
  return (
    <div className={`relative aspect-[16/9] w-full overflow-hidden rounded-2xl ${className}`}>
      <Image
        src="/login-halim-whoosh.png"
        alt={PHOTO_ALT}
        fill
        sizes="(min-width: 640px) 28rem, 100vw"
        className="object-cover"
        style={{ objectPosition: "68% 55%" }}
      />
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0b0b0f]/85 via-[#0b0b0f]/20 to-[#0b0b0f]/10"
        aria-hidden="true"
      />
      <div className="absolute inset-x-0 bottom-0 flex items-center gap-3 p-4">
        <div className="flex size-9 items-center justify-center rounded-lg bg-white text-sm font-semibold text-primary">
          RV
        </div>
        <div>
          <p className="text-sm font-semibold text-white">RailwayVision AI</p>
          <p className="text-[11px] text-white/75">Pendukung keputusan inspeksi</p>
        </div>
      </div>
    </div>
  );
}
