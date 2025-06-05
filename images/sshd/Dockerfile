FROM ubuntu

RUN apt update && apt install openssh-server sudo -y

EXPOSE 22

CMD ["/usr/sbin/sshd","-D"]
