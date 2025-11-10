import { Link } from 'react-router-dom'

export function Unauthorized() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-900">403</h1>
        <p className="mt-4 text-xl text-gray-600">Accesso non autorizzato</p>
        <p className="mt-2 text-gray-500">Non hai i permessi per accedere a questa risorsa.</p>
        <Link
          to="/login"
          className="mt-6 inline-block btn btn-primary"
        >
          Torna al Login
        </Link>
      </div>
    </div>
  )
}













