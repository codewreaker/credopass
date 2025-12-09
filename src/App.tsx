import { useLiveQuery } from '@tanstack/react-db'
import { userCollection } from './collections/user';
import './App.css'
import { User } from './entities/user';


function App() {

  const { data } = useLiveQuery(q => q.from({ userCollection }))

  // const addUser = () => userCollection.insert({
  //   createdAt: Date.now(),
  //   email: `user${crypto.randomUUID()}@email.com`,
  //   firstName: 'Day',
  //   lastName: 'Agyeman-Prmepeh',
  //   id: crypto.randomUUID(),
  //   updatedAt: Date.now(),
  //   phone: '+563456765'

  // })

  const createUser = () => {
    const user = new User('Israel', 'Agyeman-Prmepeh', `user${crypto.randomUUID()}@email.com`, '+563456765');
    user.validate();
    console.log('user', user.loyaltyTier);
    userCollection.insert(user)
  }

  const rows = Array.isArray(data) ? data : [];

  return (
    <>
      <h1>LocalFirst</h1>
      <button onClick={createUser}>Add User</button>

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
