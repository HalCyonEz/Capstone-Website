import math

def calculate_square_area():
    side_length = float(input("Enter the Side Length of Square: "))
    area = side_length ** 2
    print(f"Area = {area:.2f}")

def calculate_rectangle_area():
    length = float(input("Enter the length of a Rectangle: "))
    breadth = float(input("Enter the breadth of a Rectangle: "))
    area = length * breadth
    print(f"Area of a Rectangle is: {area:.2f}")

def calculate_parallelogram_area():
    base_length = float(input("Length of base: "))
    height = float(input("Measurement of height: "))
    area = base_length * height
    print(f"Area is: {area:.2f}")

def calculate_trapezoid_area():
    height = float(input("Height of trapezoid: "))
    base1 = float(input("Base one value: "))
    base2 = float(input("Base two value: "))
    area = 0.5 * height * (base1 + base2)
    print(f"Area is: {area:.2f}")

def calculate_triangle_area():
    a = float(input("Enter value for A: "))
    b = float(input("Enter value for B: "))
    c = float(input("Enter value for C: "))
    s = (a + b + c) / 2
    area = math.sqrt(s * (s - a) * (s - b) * (s - c))
    print(f"Area of a Triangle is: {area:.2f}")

def calculate_circle_area():
    radius = float(input("Please enter the radius of the given circle: "))
    area = math.pi * (radius ** 2)
    print(f"The area of the given circle is: {area:.2f}")

def calculate_ellipse_area():
    major_axis = float(input("Enter length of major axis: "))
    minor_axis = float(input("Enter length of minor axis: "))
    area = math.pi * major_axis * minor_axis
    print(f"Area of an Ellipse = {area:.6f}")

while True:
    print("AREA OF SHAPES CALCULATOR")
    print("==SQUARE==")
    calculate_square_area()
    print("\n==TRIANGLE==")
    calculate_triangle_area()
    print("\n==CIRCLE==")
    calculate_circle_area()
    print("\n==RECTANGLE==")
    calculate_rectangle_area()
    print("\n==PARALLELOGRAM==")
    calculate_parallelogram_area()
    print("\n==TRAPEZOID==")
    calculate_trapezoid_area()
    print("\n==ELLIPSE==")
    calculate_ellipse_area()

