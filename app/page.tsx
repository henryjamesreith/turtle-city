import { CityMap } from "./CityMap";

export default function Home() {
  return (
    <>
      <main className="mobile-only-message">
        <p>This game only supports desktop.</p>
      </main>
      <div className="desktop-game">
        <CityMap />
      </div>
    </>
  );
}
