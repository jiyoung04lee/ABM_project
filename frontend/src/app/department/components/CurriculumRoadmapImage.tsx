import Image from "next/image";

type CurriculumRoadmapImageProps = {
  src?: string;
  alt?: string;
  priority?: boolean;
};

export function CurriculumRoadmapImage({
  src = "/images/curriculum-roadmap.png",
  alt = "AI빅데이터융합경영학과 커리큘럼 로드맵",
  priority = false,
}: CurriculumRoadmapImageProps) {
  return (
    <div className="mx-auto max-w-[1200px] overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      <Image
        src={src}
        alt={alt}
        width={1196}
        height={1150}
        className="block w-full h-auto"
        priority={priority}
        sizes="(min-width: 1200px) 1196px, 100vw"
      />
    </div>
  );
}

