import "./globals.css";

export const metadata = {
  title: "Flight Deal Hunter | Find Cheapest Flights Instantly",
  description: "Stop wasting hours searching for flights. Flight Deal Hunter finds the cheapest flights and sends them straight to your inbox with real booking links.",
  keywords: "cheap flights, flight deals, flight search, cheapest flights, book flights, flight finder",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#080816" />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
