export default function Loading() {
  return (
    <div className="route-loader" role="status" aria-live="polite" aria-label="Loading page">
      <div className="route-loader__content">
        <svg
          className="route-loader__spade"
          viewBox="0 0 64 72"
          aria-hidden="true"
          focusable="false"
        >
          <defs>
            <clipPath id="spade-fill-clip">
              <rect className="route-loader__fill" x="0" y="0" width="64" height="72" />
            </clipPath>
          </defs>
          <path
            className="route-loader__spade-base"
            d="M32 2C26 12 8 22 8 38c0 8 6 14 14 14 3 0 6-1 8-3-1 8-4 13-10 17v4h24v-4c-6-4-9-9-10-17 2 2 5 3 8 3 8 0 14-6 14-14C56 22 38 12 32 2Z"
          />
          <path
            className="route-loader__spade-progress"
            clipPath="url(#spade-fill-clip)"
            d="M32 2C26 12 8 22 8 38c0 8 6 14 14 14 3 0 6-1 8-3-1 8-4 13-10 17v4h24v-4c-6-4-9-9-10-17 2 2 5 3 8 3 8 0 14-6 14-14C56 22 38 12 32 2Z"
          />
        </svg>
        <p>Dealing the next hand…</p>
      </div>
    </div>
  );
}
