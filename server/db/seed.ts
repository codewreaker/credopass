import { getDatabase, closeDatabase, initializeSchema } from "./index";


console.log("🌱 Starting database seed...\n");

try {
    const db = getDatabase();
    initializeSchema(db);

    // Optional sample data
    const sampleUsers = [
        {
            id: crypto.randomUUID(),
            email: "john.doe@example.com",
            firstName: "John",
            lastName: "Doe",
            phone: "+1234567890",
            createdAt: Date.now(),
            updatedAt: Date.now(),
        }
    ];

    const existingUsers = db.query("SELECT COUNT(*) as count FROM users").get() as { count: number };

    if (existingUsers.count === 0) {
        console.log("📝 Inserting sample users...");
        const insertUser = db.query(`
      INSERT INTO users (id, email, firstName, lastName, phone, createdAt, updatedAt)
      VALUES ($id, $email, $firstName, $lastName, $phone, $createdAt, $updatedAt)
    `);

        for (const user of sampleUsers) {
            insertUser.run(user);
        }
        console.log(`✓ Inserted ${sampleUsers.length} sample users`);
    } else {
        console.log(`ℹ️  Database already has ${existingUsers.count} user(s), skipping sample data`);
    }

    console.log("\n✅ Database seed completed successfully!");

} catch (error) {
    console.error("\n❌ Seed failed:", error);
    process.exit(1);
} finally {
    closeDatabase();
}