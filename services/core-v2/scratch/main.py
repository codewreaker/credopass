from pydantic import BaseModel
import re

class User(BaseModel):
    first_name:str
    last_name:str
    age:int = 0

    @property
    def full_name(self) -> str:
        return f"{self.first_name}, {self.last_name}"

    @property
    def full_details(self) -> str:
        return f"{self.full_name} | {self.age}"

    @classmethod
    def from_string(cls, row_str:str) -> "User":
        first_name, last_name, age = re.split(r"[,:]", row_str)
        return cls(first_name=first_name, last_name=last_name, age=age)






items: list[str] = ["Israel,Agyeman-Prempeh:30", "Nhyira,Cornelius:30", "Nana-Osei,Agyeman-Prempeh:4", "Paa-Kwesi,Agyeman-Prempeh:2"];

for item in items:
    print(User.from_string(item).full_details)