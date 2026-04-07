interface Props {
  params: { id: string }
}

export default function ListingPage({ params }: Props) {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold">Listing {params.id}</h1>
    </div>
  )
}
