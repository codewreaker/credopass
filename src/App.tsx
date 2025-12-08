import { useLiveQuery } from '@tanstack/react-db'
import { userCollection } from './collections/user';
import './App.css'


function App() {

  const { data } = useLiveQuery(q => q.from({ userCollection }))

  const addUser = () => userCollection.insert({
    createdAt: Date.now(),
    email: `user${crypto.randomUUID()}@email.com`,
    firstName: 'Israel',
    lastName: 'Agyeman-Prmepeh',
    id: crypto.randomUUID(),
    updatedAt: Date.now(),
    phone: ''

  })

  console.dir(data)
  const rows = Array.isArray(data) ? data : [];

  return (
    <>
      <h1>LocalFirst</h1>
      <button onClick={addUser}>Add User</button>

      <table className='datatable compact'>
        <thead>
          <tr>
            <th>First Name</th>
            <th>Last Name</th>
            <th>Email</th>
            <th>Phone</th>
            <th>Created At</th>
            <th>Updated At</th>
            <th>ID</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((u: any, i: number) => (
            <tr key={u.id ?? i}>
              <td>{u.firstName ?? ''}</td>
              <td>{u.lastName ?? ''}</td>
              <td>{u.email ?? ''}</td>
              <td>{u.phone ?? ''}</td>
              <td>{u.createdAt ? new Date(u.createdAt).toLocaleString() : ''}</td>
              <td>{u.updatedAt ? new Date(u.updatedAt).toLocaleString() : ''}</td>
              <td>{u.id ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </table>

    </>
  )
}

export default App
