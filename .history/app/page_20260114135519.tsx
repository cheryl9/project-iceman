export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-md mx-auto">
        <h1 className="text-3xl font-bold text-center mb-2 text-gray-800">
          Grant Matcher
        </h1>
        <p className="text-center text-gray-600 mb-8">
          Swipe right on grants that match your NPO
        </p>
        
        {/* This is where your grant cards will go */}
        <div className="bg-white rounded-2xl shadow-xl p-6 min-h-[400px] flex items-center justify-center">
          <p className="text-gray-400">Grant cards will appear here</p>
        </div>

        {/* Action buttons */}
        <div className="flex gap-4 mt-6 justify-center">
          <button className="bg-red-500 hover:bg-red-600 text-white rounded-full p-4 shadow-lg transition-all">
            ✕
          </button>
          <button className="bg-green-500 hover:bg-green-600 text-white rounded-full p-4 shadow-lg transition-all">
            ♥
          </button>
        </div>
      </div>
    </main>
  );
}