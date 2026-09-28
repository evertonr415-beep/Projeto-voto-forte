"use client";

export default function WhatsappSearchLightFix() {
  return (
    <style>{`
      @media (max-width: 760px) {
        body:has(.wa-container) .wa-search-box {
          background: #f4f7fa !important;
          background-color: #f4f7fa !important;
          border: 1px solid #dbe4ec !important;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04) !important;
        }

        body:has(.wa-container) .wa-search-box:focus-within {
          background: #ffffff !important;
          background-color: #ffffff !important;
          border-color: rgba(0, 128, 105, 0.45) !important;
          box-shadow: 0 0 0 3px rgba(0, 128, 105, 0.10) !important;
        }

        body:has(.wa-container) .wa-search-input,
        body:has(.wa-container) .wa-search-box input[type="text"] {
          display: block !important;
          width: 100% !important;
          height: 37px !important;
          padding: 0 !important;
          border: 0 !important;
          border-radius: 0 !important;
          outline: 0 !important;
          background: transparent !important;
          background-color: transparent !important;
          background-image: none !important;
          box-shadow: none !important;
          color: #1d2a31 !important;
          -webkit-text-fill-color: #1d2a31 !important;
          caret-color: #008069 !important;
          -webkit-appearance: none !important;
          appearance: none !important;
          color-scheme: light !important;
        }

        body:has(.wa-container) .wa-search-input:focus,
        body:has(.wa-container) .wa-search-input:active,
        body:has(.wa-container) .wa-search-box input[type="text"]:focus,
        body:has(.wa-container) .wa-search-box input[type="text"]:active {
          background: transparent !important;
          background-color: transparent !important;
          box-shadow: none !important;
          outline: none !important;
        }

        body:has(.wa-container) .wa-search-input::placeholder,
        body:has(.wa-container) .wa-search-box input[type="text"]::placeholder {
          color: #7b8794 !important;
          -webkit-text-fill-color: #7b8794 !important;
          opacity: 1 !important;
        }

        body:has(.wa-container) .wa-search-input:-webkit-autofill,
        body:has(.wa-container) .wa-search-input:-webkit-autofill:hover,
        body:has(.wa-container) .wa-search-input:-webkit-autofill:focus {
          -webkit-text-fill-color: #1d2a31 !important;
          -webkit-box-shadow: 0 0 0 1000px #f4f7fa inset !important;
          box-shadow: 0 0 0 1000px #f4f7fa inset !important;
          transition: background-color 9999s ease-out 0s !important;
        }
      }
    `}</style>
  );
}
