from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from reportlab.graphics import renderPDF, renderSVG
from reportlab.graphics.shapes import Drawing, Line, Polygon, Rect, String
from reportlab.lib.colors import HexColor, white


ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "LMS Documentation"
OUT.mkdir(parents=True, exist_ok=True)


PALETTE = {
    "start": ("#0f766e", "#115e59", "#ffffff"),
    "hub": ("#0369a1", "#075985", "#ffffff"),
    "core": ("#dbeafe", "#2563eb", "#1e3a8a"),
    "monitor": ("#d1fae5", "#059669", "#064e3b"),
    "report": ("#fef3c7", "#d97706", "#78350f"),
    "admin": ("#fce7f3", "#db2777", "#831843"),
    "personal": ("#f3e8ff", "#9333ea", "#581c87"),
    "decision": ("#ffedd5", "#ea580c", "#7c2d12"),
    "alert": ("#fee2e2", "#dc2626", "#7f1d1d"),
    "viewer": ("#f1f5f9", "#64748b", "#334155"),
}


@dataclass
class Node:
    x: float
    y: float
    w: float
    h: float
    lines: list[str]
    kind: str = "core"
    rounded: bool = False
    diamond: bool = False

    @property
    def top(self): return self.y

    @property
    def bottom(self): return self.y + self.h

    @property
    def left(self): return self.x

    @property
    def right(self): return self.x + self.w

    @property
    def cx(self): return self.x + self.w / 2

    @property
    def cy(self): return self.y + self.h / 2


class Diagram:
    def __init__(self, width, height, title):
        self.w = width
        self.h = height
        self.d = Drawing(width, height)
        self.d.add(Rect(0, 0, width, height, fillColor=white, strokeColor=None))
        self.d.add(String(width / 2, height - 50, title, textAnchor="middle",
                          fontName="Helvetica", fontSize=30, fillColor=HexColor("#000000")))

    def py(self, y):
        return self.h - y

    def group_box(self, x, y, w, h, label, color="#cbd5e1"):
        self.d.add(Rect(x, self.py(y + h), w, h, fillColor=None,
                        strokeColor=HexColor(color), strokeWidth=1.2, rx=4, ry=4,
                        strokeDashArray=[5, 4]))
        self.d.add(String(x + 10, self.py(y + 17), label, fontName="Helvetica-Bold",
                          fontSize=11, fillColor=HexColor("#475569")))

    def node(self, n: Node):
        fill, stroke, text = (HexColor(c) for c in PALETTE[n.kind])
        if n.diamond:
            pts = [n.cx, self.py(n.y), n.right, self.py(n.cy), n.cx, self.py(n.bottom), n.left, self.py(n.cy)]
            self.d.add(Polygon(pts, fillColor=fill, strokeColor=stroke, strokeWidth=2))
        else:
            radius = 18 if n.rounded else 0
            self.d.add(Rect(n.x, self.py(n.bottom), n.w, n.h, fillColor=fill,
                            strokeColor=stroke, strokeWidth=2 if n.kind in ("start", "hub", "alert") else 1.4,
                            rx=radius, ry=radius))
        line_height = 16
        start_y = n.cy - (len(n.lines) - 1) * line_height / 2 + 5
        for i, line in enumerate(n.lines):
            self.d.add(String(n.cx, self.py(start_y + i * line_height), line,
                              textAnchor="middle", fontName="Helvetica",
                              fontSize=10.5 if len(line) < 34 else 9.5, fillColor=text))

    def arrow(self, points, label=None, color="#111827", dashed=False):
        stroke = HexColor(color)
        converted = [(x, self.py(y)) for x, y in points]
        for (x1, y1), (x2, y2) in zip(converted, converted[1:]):
            kwargs = {"strokeColor": stroke, "strokeWidth": 1.5}
            if dashed:
                kwargs["strokeDashArray"] = [4, 3]
            self.d.add(Line(x1, y1, x2, y2, **kwargs))
        (x1, y1), (x2, y2) = converted[-2], converted[-1]
        if abs(x2 - x1) >= abs(y2 - y1):
            sign = 1 if x2 > x1 else -1
            head = [x2, y2, x2 - sign * 9, y2 + 5, x2 - sign * 9, y2 - 5]
        else:
            sign = 1 if y2 > y1 else -1
            head = [x2, y2, x2 - 5, y2 - sign * 9, x2 + 5, y2 - sign * 9]
        self.d.add(Polygon(head, fillColor=stroke, strokeColor=stroke))
        if label:
            mid = points[len(points) // 2]
            self.d.add(String(mid[0] + 5, self.py(mid[1] - 5), label,
                              fontName="Helvetica", fontSize=9, fillColor=HexColor("#475569")))

    def legend(self, x, y, rows):
        height = 34 + len(rows) * 52
        self.d.add(Rect(x, self.py(y + height), 250, height, fillColor=HexColor("#f8fafc"),
                        strokeColor=HexColor("#94a3b8"), strokeWidth=1.2))
        self.d.add(String(x + 125, self.py(y + 20), "Who can do what",
                          textAnchor="middle", fontName="Helvetica-Bold", fontSize=11,
                          fillColor=HexColor("#475569")))
        for idx, (kind, text) in enumerate(rows):
            fill, stroke, text_color = (HexColor(c) for c in PALETTE[kind])
            ry = y + 34 + idx * 52
            self.d.add(Rect(x + 12, self.py(ry + 40), 226, 40, fillColor=fill,
                            strokeColor=stroke, strokeWidth=1.3))
            self.d.add(String(x + 125, self.py(ry + 24), text, textAnchor="middle",
                              fontName="Helvetica", fontSize=9.2, fillColor=text_color))

    def save(self, stem):
        svg = OUT / f"{stem}.svg"
        pdf = OUT / f"{stem}.pdf"
        renderSVG.drawToFile(self.d, str(svg))
        renderPDF.drawToFile(self.d, str(pdf), title=stem)
        return svg, pdf


def full_overview():
    g = Diagram(2300, 1260, "Full System Overview Diagram - Q-Learning Management System")
    login = Node(80, 90, 140, 48, ["Sign in"], "start", rounded=True)
    dash = Node(55, 180, 190, 78, ["Role Dashboard", "Staff KPIs or", "trainee progress"], "hub")
    trainings = Node(330, 320, 210, 72, ["Trainings", "Create, import, open"], "core")
    trainees = Node(660, 320, 210, 72, ["Trainees", "Directory and enrollment"], "monitor")
    qbank = Node(990, 320, 210, 72, ["Question Bank", "Questions and answers"], "report")
    settings = Node(1320, 320, 230, 72, ["Settings", "Reference data and users"], "admin")
    profile = Node(1680, 320, 190, 72, ["Profile", "Details and password"], "personal")
    workspace = Node(330, 500, 240, 78, ["Training Workspace", "Role-sensitive tabs"], "hub")
    course = Node(130, 690, 200, 70, ["Course / Materials", "Sections, files, media"], "core")
    tests = Node(390, 690, 190, 70, ["Tests", "Pre, post, cert, refresher"], "report")
    people = Node(640, 690, 170, 70, ["People", "Trainers and trainees"], "monitor")
    attendance = Node(870, 690, 190, 70, ["Attendance", "Sessions and status"], "monitor")
    marks = Node(1120, 690, 190, 70, ["Marks", "Scores and practical"], "core")
    package = Node(1370, 690, 190, 70, ["Package", "PDF / XLSX / ZIP"], "report")
    tsettings = Node(1620, 690, 190, 70, ["Training Settings", "Assignments and status"], "admin")
    complete = Node(1090, 875, 230, 130, ["Requirements complete?"], "decision", diamond=True)
    release = Node(1080, 1080, 250, 66, ["Release results", "Issue certificate"], "alert")
    trainee_view = Node(1510, 1065, 250, 82, ["Trainee My Results", "Download result / certificate"], "personal")
    for n in [login, dash, trainings, trainees, qbank, settings, profile, workspace, course, tests,
              people, attendance, marks, package, tsettings, complete, release, trainee_view]:
        g.node(n)
    g.group_box(95, 640, 1760, 170, "Training workspace tabs")
    g.arrow([(login.cx, login.bottom), (login.cx, dash.top)])
    for n in [trainings, trainees, qbank, settings, profile]:
        g.arrow([(dash.right, dash.cy), (270, dash.cy), (270, 285), (n.cx, 285), (n.cx, n.top)])
    g.arrow([(trainings.cx, trainings.bottom), (trainings.cx, workspace.top)])
    for n in [course, tests, people, attendance, marks, package, tsettings]:
        g.arrow([(workspace.cx, workspace.bottom), (workspace.cx, 620), (n.cx, 620), (n.cx, n.top)])
    for n in [tests, attendance, marks]:
        g.arrow([(n.cx, n.bottom), (n.cx, 840), (complete.cx, 840), (complete.cx, complete.top)])
    g.arrow([(complete.cx, complete.bottom), (complete.cx, release.top)], "Yes")
    g.arrow([(release.right, release.cy), (trainee_view.left, trainee_view.cy)])
    g.arrow([(package.cx, package.bottom), (package.cx, 1030), (release.cx, 1030), (release.cx, release.top)], dashed=True)
    g.legend(1960, 280, [
        ("viewer", "Trainee - own learning records"),
        ("monitor", "Trainer - delivery and grading"),
        ("admin", "Admin - full configuration access"),
    ])
    return g.save("Full System Overview Diagram LMS")


def admin_flow():
    g = Diagram(2400, 900, "Admin Role - How to Use Each Tab")
    login = Node(1080, 80, 240, 52, ["Sign in as Admin"], "start", rounded=True)
    dash = Node(1080, 175, 240, 76, ["Dashboard", "KPIs, filters, PDF report"], "hub")
    modules = [
        Node(80, 350, 260, 74, ["Trainings", "Create / import / lifecycle"], "core"),
        Node(420, 350, 260, 74, ["Trainees", "Create / import / bulk actions"], "monitor"),
        Node(760, 350, 260, 74, ["Question Bank", "Create / edit / bulk upload"], "report"),
        Node(1100, 350, 260, 74, ["Training Workspace", "All management tabs"], "core"),
        Node(1440, 350, 260, 74, ["Settings", "Reference data and users"], "admin"),
        Node(1780, 350, 260, 74, ["Profile", "Details / certificate / password"], "personal"),
    ]
    actions = [
        Node(50, 610, 230, 64, ["Configure and activate", "training"], "core"),
        Node(330, 610, 230, 64, ["Assign trainers, trainees,", "healthcare and devices"], "monitor"),
        Node(610, 610, 230, 64, ["Build course and", "assessment content"], "report"),
        Node(890, 610, 230, 64, ["Record attendance and", "practical outcomes"], "monitor"),
        Node(1170, 610, 230, 64, ["Review marks and", "release results"], "alert"),
        Node(1450, 610, 230, 64, ["Generate package and", "certificate files"], "report"),
        Node(1730, 610, 230, 64, ["Maintain users and", "reference catalogs"], "admin"),
        Node(2010, 610, 230, 64, ["Update profile", "or sign out"], "personal"),
    ]
    for n in [login, dash] + modules + actions:
        g.node(n)
    g.arrow([(login.cx, login.bottom), (dash.cx, dash.top)])
    for n in modules:
        g.arrow([(dash.cx, dash.bottom), (dash.cx, 300), (n.cx, 300), (n.cx, n.top)])
    sources = [modules[0], modules[0], modules[2], modules[3], modules[3], modules[3], modules[4], modules[5]]
    for src, dst in zip(sources, actions):
        g.arrow([(src.cx, src.bottom), (src.cx, 520), (dst.cx, 520), (dst.cx, dst.top)])
    g.legend(2070, 120, [("admin", "Admin - full system access")])
    return g.save("Admin Role User Flow Diagram LMS")


def trainer_flow():
    g = Diagram(2400, 860, "Trainer Role - How to Use Each Tab")
    login = Node(1080, 80, 240, 52, ["Sign in as Trainer"], "start", rounded=True)
    dash = Node(1080, 175, 240, 76, ["Dashboard", "Training and trainee overview"], "hub")
    modules = [
        Node(100, 350, 270, 74, ["Trainings", "Create / import / manage"], "core"),
        Node(450, 350, 270, 74, ["Trainees", "Directory and bulk tools"], "monitor"),
        Node(800, 350, 270, 74, ["Question Bank", "Questions and bulk upload"], "report"),
        Node(1150, 350, 270, 74, ["Training Workspace", "Course, marks, attendance"], "core"),
        Node(1500, 350, 270, 74, ["Settings", "Non-user reference data"], "admin"),
        Node(1850, 350, 270, 74, ["Profile", "Details / certificate / password"], "personal"),
    ]
    actions = [
        Node(160, 610, 250, 64, ["Prepare sections,", "materials and tests"], "core"),
        Node(480, 610, 250, 64, ["Verify enrollment and", "people list"], "monitor"),
        Node(800, 610, 250, 64, ["Mark attendance and", "review responses"], "monitor"),
        Node(1120, 610, 250, 64, ["Score practical work", "and calculate grades"], "core"),
        Node(1440, 610, 250, 64, ["Release permitted results", "and generate package"], "alert"),
        Node(1760, 610, 250, 64, ["Maintain reference lists", "within permissions"], "admin"),
    ]
    for n in [login, dash] + modules + actions:
        g.node(n)
    g.arrow([(login.cx, login.bottom), (dash.cx, dash.top)])
    for n in modules:
        g.arrow([(dash.cx, dash.bottom), (dash.cx, 300), (n.cx, 300), (n.cx, n.top)])
    sources = [modules[0], modules[1], modules[3], modules[3], modules[3], modules[4]]
    for src, dst in zip(sources, actions):
        g.arrow([(src.cx, src.bottom), (src.cx, 520), (dst.cx, 520), (dst.cx, dst.top)])
    g.legend(2070, 120, [("monitor", "Trainer - delivery and grading")])
    return g.save("Trainer Role User Flow Diagram LMS")


def trainee_flow():
    g = Diagram(2200, 900, "Trainee Role - Learning and Certification Flow")
    register = Node(120, 100, 220, 56, ["Register or sign in"], "start", rounded=True)
    status = Node(420, 75, 230, 110, ["Account active", "or registered?"], "decision", diamond=True)
    dash = Node(740, 95, 230, 76, ["Dashboard", "Progress and certificates"], "hub")
    training = Node(1080, 95, 230, 76, ["Open enrolled training", "from Trainings"], "core")
    tabs = [
        Node(110, 340, 220, 68, ["Stream", "Training overview"], "core"),
        Node(390, 340, 220, 68, ["Materials", "Documents, media, links"], "core"),
        Node(670, 340, 220, 68, ["Course", "Learning sequence"], "monitor"),
        Node(950, 340, 220, 68, ["Tests", "Complete assessments"], "report"),
        Node(1230, 340, 220, 68, ["People", "Trainers and trainees"], "monitor"),
        Node(1510, 340, 220, 68, ["Profile", "Personal details / password"], "personal"),
    ]
    attempt = Node(820, 560, 240, 68, ["Submit test attempt", "and complete attendance"], "report")
    released = Node(1140, 535, 230, 118, ["Results released?"], "decision", diamond=True)
    results = Node(1480, 560, 240, 68, ["My Results", "Scores and comments"], "personal")
    certificate = Node(1810, 560, 250, 68, ["Download result", "and certificate"], "alert")
    contact = Node(390, 600, 250, 68, ["Contact administrator", "Account status blocks access"], "alert")
    for n in [register, status, dash, training] + tabs + [attempt, released, results, certificate, contact]:
        g.node(n)
    g.arrow([(register.right, register.cy), (status.left, status.cy)])
    g.arrow([(status.right, status.cy), (dash.left, dash.cy)], "Yes")
    g.arrow([(dash.right, dash.cy), (training.left, training.cy)])
    for n in tabs:
        g.arrow([(training.cx, training.bottom), (training.cx, 270), (n.cx, 270), (n.cx, n.top)])
    g.arrow([(tabs[3].cx, tabs[3].bottom), (tabs[3].cx, attempt.top)])
    g.arrow([(attempt.right, attempt.cy), (released.left, released.cy)])
    g.arrow([(released.right, released.cy), (results.left, results.cy)], "Yes")
    g.arrow([(results.right, results.cy), (certificate.left, certificate.cy)])
    g.arrow([(status.cx, status.bottom), (350, status.bottom), (350, contact.cy), (contact.left, contact.cy)], "No", dashed=True)
    g.legend(1830, 100, [("viewer", "Trainee - own records only")])
    return g.save("Trainee Role User Flow Diagram LMS")


if __name__ == "__main__":
    outputs = full_overview() + admin_flow() + trainer_flow() + trainee_flow()
    for path in outputs:
        print(path)
