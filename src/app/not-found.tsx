import Link from "next/link";

export default function NotFound() {
  return (
    <div className="grid min-h-[50vh] place-items-center text-center">
      <div>
        <p className="label mb-3">404</p>
        <h1 className="font-display text-4xl text-parchment-50">This page is not in the archive.</h1>
        <p className="mt-3 text-parchment-300">
          It may not have been extracted yet, or the reference is wrong.
        </p>
        <Link
          href="/browse"
          className="mt-6 inline-block rounded-md bg-ochre px-5 py-2.5 font-medium text-ink-950 hover:bg-amber"
        >
          Back to the archive
        </Link>
      </div>
    </div>
  );
}
