interface Props {
  params: { id: string };
}

export default function CommunityDetailPage({ params }: Props) {
  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold">
        게시물 상세 페이지
      </h1>
      <p className="mt-4">Post ID: {params.id}</p>
    </div>
  );
}