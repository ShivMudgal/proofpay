import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-24 text-center">
      <h1 className="text-xl font-semibold">Page not found</h1>
      <Link href="/" className="text-sm text-accent hover:underline mt-2 inline-block">Back to overview</Link>
    </div>
  );
}
